// Reads scanned cards with Claude, in batches (half price, results within minutes to hours).
//   POST { action: "submit", model?, ids? } sends the user's pending scans as one Message Batch.
//   POST { action: "poll" } collects finished results into card_scans.extraction.
// Runs as the signed-in user, so row-level security applies to every query.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { EXTRACTION_SCHEMA, systemPrompt, type KnownNames } from './prompt.ts'

const MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'] as const
type Model = (typeof MODELS)[number]
const DEFAULT_MODEL: Model = 'claude-sonnet-5-5'

/** Batches can take up to 24 hours, so photo links must outlive that. */
const PHOTO_URL_SECONDS = 3 * 24 * 3600
const MAX_KNOWN_NAMES = 300

const CORS = {
  'Access-Control-Allow-Origin': '*',
  // `*` covers whatever else supabase-js sends; Authorization must be named explicitly.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, *',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const authorization = req.headers.get('Authorization')
  const apiKey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization || !apiKey) return json({ error: 'Sign in first.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  // No stored session on the server, so verify the caller's token directly.
  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.replace(/^Bearer /i, ''))
  if (userError || !userData.user) return json({ error: 'Sign in first.' }, 401)

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'submit') {
      const model: Model = MODELS.includes(body.model) ? body.model : DEFAULT_MODEL
      return json(await submit(supabase, anthropic, model, Array.isArray(body.ids) ? body.ids : null))
    }
    if (body.action === 'poll') return json(await poll(supabase, anthropic))
    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, 500)
  }
})

async function submit(supabase: SupabaseClient, anthropic: Anthropic, model: Model, ids: string[] | null) {
  let query = supabase.from('card_scans').select('id, front_image_path, back_image_path').eq('status', 'pending')
  if (ids) query = query.in('id', ids)
  const { data: scans, error } = await query
  if (error) throw error
  if (!scans.length) return { submitted: 0 }

  const paths = scans.flatMap((s) => [s.front_image_path, s.back_image_path].filter(Boolean)) as string[]
  const { data: signed, error: signError } = await supabase.storage
    .from('card-photos')
    .createSignedUrls(paths, PHOTO_URL_SECONDS)
  if (signError) throw signError
  const urls = new Map(signed.map((s) => [s.path, s.signedUrl]))

  const system = systemPrompt(await knownNames(supabase))
  const batch = await anthropic.messages.batches.create({
    requests: scans.map((scan) => ({
      custom_id: scan.id,
      params: {
        model,
        max_tokens: 16000,
        // Same instructions for every card in the batch, so cache them.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        // Haiku 4.5 predates adaptive thinking and effort; the newer models think before answering.
        ...(model === 'claude-haiku-4-5' ? {} : { thinking: { type: 'adaptive' } }),
        output_config: {
          ...(model === 'claude-haiku-4-5' ? {} : { effort: 'medium' }),
          format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Front:' },
              { type: 'image', source: { type: 'url', url: urls.get(scan.front_image_path)! } },
              ...(scan.back_image_path
                ? [
                    { type: 'text', text: 'Back:' },
                    { type: 'image', source: { type: 'url', url: urls.get(scan.back_image_path)! } },
                  ]
                : [{ type: 'text', text: 'No photo of the back was taken.' }]),
              { type: 'text', text: 'Read this card.' },
            ],
          },
        ],
      },
    })) as Anthropic.Messages.BatchCreateParams.Request[],
  })

  const { error: updateError } = await supabase
    .from('card_scans')
    .update({ status: 'processing', batch_id: batch.id, error: null })
    .in(
      'id',
      scans.map((s) => s.id),
    )
  if (updateError) throw updateError
  return { submitted: scans.length, batch_id: batch.id, model }
}

async function poll(supabase: SupabaseClient, anthropic: Anthropic) {
  const { data: scans, error } = await supabase.from('card_scans').select('id, batch_id').eq('status', 'processing')
  if (error) throw error
  const batchIds = [...new Set(scans.map((s) => s.batch_id).filter(Boolean))] as string[]

  let updated = 0
  let stillProcessing = 0
  for (const batchId of batchIds) {
    const batch = await anthropic.messages.batches.retrieve(batchId)
    if (batch.processing_status !== 'ended') {
      stillProcessing += scans.filter((s) => s.batch_id === batchId).length
      continue
    }
    for await (const result of await anthropic.messages.batches.results(batchId)) {
      const update = toScanUpdate(result)
      const { error: updateError } = await supabase
        .from('card_scans')
        .update(update)
        .eq('id', result.custom_id)
        .eq('status', 'processing') // skip cards reviewed or deleted meanwhile
      if (updateError) throw updateError
      updated++
    }
  }
  return { updated, processing: stillProcessing }
}

function toScanUpdate(result: Anthropic.Messages.MessageBatchIndividualResponse) {
  if (result.result.type !== 'succeeded') {
    const reason =
      result.result.type === 'errored'
        ? `The AI request failed (${result.result.error.error?.type ?? 'error'}).`
        : `The AI request ${result.result.type}.`
    return { status: 'failed', error: `${reason} Fill it in by hand, or try reading it again.` }
  }
  const message = result.result.message
  const usage = { model: message.model, usage: message.usage }
  if (message.stop_reason === 'refusal') {
    return { status: 'failed', error: 'The AI declined to read this card. Fill it in by hand.', extraction: usage }
  }
  const text = message.content.find((block) => block.type === 'text')
  try {
    if (message.stop_reason === 'max_tokens' || !text || text.type !== 'text') throw new Error('incomplete')
    return { status: 'ready', error: null, extraction: { ...JSON.parse(text.text), ...usage } }
  } catch {
    return { status: 'failed', error: 'The AI’s answer was incomplete. Try reading it again.', extraction: usage }
  }
}

/** The collector's own spellings, so the AI reuses them. */
async function knownNames(supabase: SupabaseClient): Promise<KnownNames> {
  const { data, error } = await supabase
    .from('cards')
    .select('set_name, insert_name, parallel, team')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  const distinct = (key: keyof KnownNames) =>
    [...new Set(data.map((c) => c[key]).filter((v): v is string => Boolean(v)))].slice(0, MAX_KNOWN_NAMES)
  return {
    set_name: distinct('set_name'),
    insert_name: distinct('insert_name'),
    parallel: distinct('parallel'),
    team: distinct('team'),
  }
}
