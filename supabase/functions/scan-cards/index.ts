// Reads scanned cards with Claude, in batches (half price, results within minutes to hours).
//   POST { action: "submit", model?, ids? } sends the user's pending scans as one Message Batch.
//   POST { action: "poll" } collects finished results into card_scans.extraction. Cards whose reading
//     has a doubt a checklist can settle (see triage.ts) go out again, once, with web search.
//   POST { action: "lookup", ids } runs that checklist pass on reviewed-ready cards on request.
// Runs as the signed-in user, so row-level security applies to every query.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  EXTRACTION_SCHEMA,
  FIELDS,
  LOOKUP_MAX_SEARCHES,
  lookupInstructions,
  RECORD_CARD_TOOL,
  systemPrompt,
  type KnownNames,
} from './prompt.ts'
import { triage } from './triage.ts'

const MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'] as const
type Model = (typeof MODELS)[number]
const DEFAULT_MODEL: Model = 'claude-sonnet-5-5'
const isModel = (value: unknown): value is Model => MODELS.includes(value as Model)

/** Batches can take up to 24 hours, so photo links must outlive that. */
const PHOTO_URL_SECONDS = 3 * 24 * 3600
const MAX_KNOWN_NAMES = 300
/** A lookup that was claimed but never sent (the function died mid-way) is released after this long. */
const STUCK_LOOKUP_MS = 10 * 60_000

type Scan = { id: string; front_image_path: string; back_image_path: string | null }
type Reading = Record<string, unknown> & { model?: string; uncertain_fields?: string[] }
type ScanWithReading = Scan & { extraction: Reading }

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
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : null
    if (body.action === 'submit') {
      return json(await submit(supabase, anthropic, isModel(body.model) ? body.model : DEFAULT_MODEL, ids))
    }
    if (body.action === 'poll') return json(await poll(supabase, anthropic))
    if (body.action === 'lookup' && ids) return json(await requestLookups(supabase, anthropic, ids))
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

  const urls = await photoUrls(supabase, scans)
  const system = systemPrompt(await knownNames(supabase))
  const batch = await anthropic.messages.batches.create({
    requests: scans.map((scan) => ({
      custom_id: scan.id,
      params: {
        model,
        max_tokens: 16000,
        // Same instructions for every card in the batch, so cache them.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        ...thinking(model),
        output_config: {
          ...effort(model),
          format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
        },
        messages: [{ role: 'user', content: [...photoBlocks(scan, urls), { type: 'text', text: 'Read this card.' }] }],
      },
    })) as unknown as Anthropic.Messages.BatchCreateParams.Request[],
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
  const { data: scans, error } = await supabase
    .from('card_scans')
    .select('id, front_image_path, back_image_path, status, batch_id, extraction, updated_at')
    .in('status', ['processing', 'looking_up'])
  if (error) throw error
  await releaseStuckLookups(supabase, scans)
  const byId = new Map(scans.map((s) => [s.id, s]))
  const batchIds = [...new Set(scans.map((s) => s.batch_id).filter(Boolean))] as string[]

  let updated = 0
  let stillProcessing = 0
  const toLookUp: ScanWithReading[] = []
  for (const batchId of batchIds) {
    const batch = await anthropic.messages.batches.retrieve(batchId)
    if (batch.processing_status !== 'ended') {
      stillProcessing += scans.filter((s) => s.batch_id === batchId).length
      continue
    }
    for await (const result of await anthropic.messages.batches.results(batchId)) {
      const scan = byId.get(result.custom_id)
      if (!scan) continue // reviewed or deleted meanwhile
      if (scan.status === 'looking_up') {
        const update = toLookupUpdate(result, scan.extraction as Reading)
        // Only if still waiting: the card may have been saved while the lookup ran.
        const { error: updateError } = await supabase
          .from('card_scans')
          .update(update)
          .eq('id', scan.id)
          .eq('status', 'looking_up')
        if (updateError) throw updateError
      } else {
        const update = toScanUpdate(result)
        const next = update.status === 'ready' ? triage(update.extraction as Reading) : null
        if (next) update.extraction = { ...update.extraction, triage: next }
        if (next === 'lookup') Object.assign(update, { status: 'looking_up', batch_id: null })
        // Claiming the row by its status means two polls at once can't both send its lookup.
        const { data: claimed, error: updateError } = await supabase
          .from('card_scans')
          .update(update)
          .eq('id', scan.id)
          .eq('status', 'processing')
          .select('id')
        if (updateError) throw updateError
        if (next === 'lookup' && claimed.length) {
          toLookUp.push({ ...scan, extraction: update.extraction as Reading })
        }
      }
      updated++
    }
  }

  if (toLookUp.length) await sendLookupsOrRelease(supabase, anthropic, toLookUp)
  return { updated, processing: stillProcessing + toLookUp.length }
}

/** The checklist pass on request, for cards already read (whatever the triage said). Once per card. */
async function requestLookups(supabase: SupabaseClient, anthropic: Anthropic, ids: string[]) {
  const { data, error } = await supabase
    .from('card_scans')
    .update({ status: 'looking_up', batch_id: null })
    .in('id', ids)
    .eq('status', 'ready')
    .not('extraction', 'is', null)
    .is('extraction->lookup', null)
    .select('id, front_image_path, back_image_path, extraction')
  if (error) throw error
  const scans = data as ScanWithReading[]
  if (scans.length) await sendLookupsOrRelease(supabase, anthropic, scans)
  return { submitted: scans.length }
}

async function sendLookupsOrRelease(supabase: SupabaseClient, anthropic: Anthropic, scans: ScanWithReading[]) {
  try {
    await submitLookups(supabase, anthropic, scans)
  } catch (err) {
    console.error(err)
    // The reading is still good: show it, and say the search didn't happen.
    const message = err instanceof Error ? err.message : 'unknown error'
    for (const scan of scans) {
      await supabase
        .from('card_scans')
        .update({
          status: 'ready',
          extraction: { ...scan.extraction, lookup: { error: `The checklist search couldn’t start (${message}).` } },
        })
        .eq('id', scan.id)
    }
  }
}

async function submitLookups(supabase: SupabaseClient, anthropic: Anthropic, scans: ScanWithReading[]) {
  const urls = await photoUrls(supabase, scans)
  const system = systemPrompt(await knownNames(supabase))
  const batch = await anthropic.messages.batches.create({
    requests: scans.map((scan) => {
      const model = isModel(scan.extraction.model) ? scan.extraction.model : DEFAULT_MODEL
      return {
        custom_id: scan.id,
        params: {
          model,
          max_tokens: 16000,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          ...thinking(model),
          ...(model === 'claude-haiku-4-5' ? {} : { output_config: effort(model) }),
          tools: [
            // Dynamic filtering trims search results before they reach the model; Haiku 4.5 predates it.
            model === 'claude-haiku-4-5'
              ? { type: 'web_search_20250305', name: 'web_search', max_uses: LOOKUP_MAX_SEARCHES }
              : { type: 'web_search_20260209', name: 'web_search', max_uses: LOOKUP_MAX_SEARCHES },
            RECORD_CARD_TOOL,
          ],
          messages: [
            {
              role: 'user',
              content: [...photoBlocks(scan, urls), { type: 'text', text: lookupInstructions(scan.extraction) }],
            },
          ],
        },
      }
    }) as unknown as Anthropic.Messages.BatchCreateParams.Request[],
  })
  const { error } = await supabase
    .from('card_scans')
    .update({ batch_id: batch.id })
    .in(
      'id',
      scans.map((s) => s.id),
    )
  if (error) throw error
}

/** A lookup claimed but never sent stays on screen as its first reading rather than "checking" forever. */
async function releaseStuckLookups(
  supabase: SupabaseClient,
  scans: { id: string; status: string; batch_id: string | null; extraction: unknown; updated_at: string }[],
) {
  const cutoff = Date.now() - STUCK_LOOKUP_MS
  for (const scan of scans) {
    if (scan.status !== 'looking_up' || scan.batch_id || Date.parse(scan.updated_at) > cutoff) continue
    await supabase
      .from('card_scans')
      .update({
        status: 'ready',
        extraction: { ...(scan.extraction as Reading), lookup: { error: 'The checklist search didn’t start.' } },
      })
      .eq('id', scan.id)
      .eq('status', 'looking_up')
  }
}

function toScanUpdate(result: Anthropic.Messages.MessageBatchIndividualResponse): {
  status: string
  error?: string | null
  extraction?: Record<string, unknown>
} {
  if (result.result.type !== 'succeeded') {
    return { status: 'failed', error: `${failureReason(result)} Fill it in by hand, or try reading it again.` }
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

/** Folds the checklist pass into the reading. Whatever happens, the card lands in review: never another lookup. */
function toLookupUpdate(result: Anthropic.Messages.MessageBatchIndividualResponse, reading: Reading) {
  const done = (lookup: Record<string, unknown>) => ({ status: 'ready', extraction: { ...reading, lookup } })
  if (result.result.type !== 'succeeded') return done({ error: `${failureReason(result)} Showing the first reading.` })

  const message = result.result.message
  const cost = {
    model: message.model,
    usage: message.usage,
    searches: message.usage.server_tool_use?.web_search_requests ?? 0,
  }
  const call = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use' && block.name === 'record_card',
  )
  if (!call) {
    return done({ ...cost, error: 'The checklist search didn’t finish. Showing the first reading.' })
  }
  const input = call.input as Record<string, unknown>

  // Only keep links that really came back from a search, with their page titles.
  const seen = new Map<string, string>()
  for (const block of message.content as unknown as { type: string; content?: unknown }[]) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue
    for (const hit of block.content as { url?: string; title?: string }[]) {
      if (hit.url) seen.set(hit.url, hit.title ?? hit.url)
    }
  }
  const sources = ((input.source_urls as string[] | undefined) ?? [])
    .filter((url) => seen.has(url))
    .slice(0, 3)
    .map((url) => ({ url, title: seen.get(url) }))

  const fields = Object.fromEntries(FIELDS.map((f) => [f, input[f]]))
  const changed = FIELDS.filter((f) => normalize(input[f]) !== normalize(reading[f]))
  return done({
    ...cost,
    fields,
    changed,
    confirmed: input.confirmed_fields ?? [],
    still_uncertain: input.still_uncertain ?? [],
    sources,
    notes: input.notes ?? '',
  })
}

function failureReason(result: Anthropic.Messages.MessageBatchIndividualResponse): string {
  return result.result.type === 'errored'
    ? `The AI request failed (${result.result.error.error?.type ?? 'error'}).`
    : `The AI request ${result.result.type}.`
}

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : (value ?? null))

/** Haiku 4.5 predates adaptive thinking and effort; the newer models think before answering. */
function thinking(model: Model) {
  return model === 'claude-haiku-4-5' ? {} : { thinking: { type: 'adaptive' } }
}

function effort(model: Model) {
  return model === 'claude-haiku-4-5' ? {} : { effort: 'medium' }
}

async function photoUrls(supabase: SupabaseClient, scans: Scan[]): Promise<Map<string, string>> {
  const paths = scans.flatMap((s) => [s.front_image_path, s.back_image_path].filter(Boolean)) as string[]
  const { data, error } = await supabase.storage.from('card-photos').createSignedUrls(paths, PHOTO_URL_SECONDS)
  if (error) throw error
  return new Map(data.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])))
}

function photoBlocks(scan: Scan, urls: Map<string, string>) {
  return [
    { type: 'text', text: 'Front:' },
    { type: 'image', source: { type: 'url', url: urls.get(scan.front_image_path)! } },
    ...(scan.back_image_path
      ? [
          { type: 'text', text: 'Back:' },
          { type: 'image', source: { type: 'url', url: urls.get(scan.back_image_path)! } },
        ]
      : [{ type: 'text', text: 'No photo of the back was taken.' }]),
  ]
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
