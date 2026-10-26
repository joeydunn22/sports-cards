// Reads scanned cards with Claude, in batches (half price, results within minutes to hours).
//   POST { action: "submit", model?, ids? } sends the user's pending scans as one Message Batch.
//   POST { action: "poll" } collects finished results into card_scans.extraction. Cards whose reading
//     has a doubt a checklist can settle (see triage.ts) go out again, once, with web search.
//   POST { action: "lookup", ids } runs that checklist pass on reviewed-ready cards on request.
//   POST { action: "parallels", sets: [{ year, set_name }], now?, model? } fetches each set's parallel list
//     (public.set_parallels): right away when `now` (the card form waits for it), otherwise as a batch.
//   POST { action: "poll_parallels" } collects finished parallel-list batches.
// A print run read off a card, checked against its set's parallel list, can settle the parallel for free.
// Every call's actual cost goes in public.ai_usage, which the app subtracts from the credit balance.
// Runs as the signed-in user, so row-level security applies to every query.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  EXTRACTION_SCHEMA,
  FIELDS,
  LOOKUP_MAX_SEARCHES,
  lookupInstructions,
  parallelsInstructions,
  RECORD_CARD_TOOL,
  RECORD_PARALLELS_TOOL,
  systemPrompt,
  type KnownNames,
} from './prompt.ts'
import { cacheHint, entryFromSearch, findSpot, resolveFromCache, type Entry } from './cache.ts'
import { hasList, rainbowHint, rowsFromSearch, settleParallel, type Rainbow } from './rainbow.ts'
import { usageDollars } from './pricing.ts'
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
type UsageRow = {
  kind: 'read' | 'lookup' | 'parallels'
  model: string
  searches: number
  input_tokens: number
  output_tokens: number
  dollars: number
}

function usageRow(kind: UsageRow['kind'], message: Anthropic.Messages.Message, batch: boolean): UsageRow {
  const u = message.usage
  return {
    kind,
    model: message.model,
    searches: u.server_tool_use?.web_search_requests ?? 0,
    input_tokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    output_tokens: u.output_tokens,
    dollars: usageDollars(message.model, u, { batch }),
  }
}

async function logUsage(supabase: SupabaseClient, rows: UsageRow[]) {
  if (rows.length === 0) return
  const { error } = await supabase.from('ai_usage').insert(rows)
  // The work itself succeeded; a missing log line only makes the balance estimate a bit optimistic.
  if (error) console.error('ai_usage insert failed', error)
}

/** The checklist cache (public.checklist_entries); small enough to load whole. */
async function loadChecklist(supabase: SupabaseClient): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('checklist_entries')
    .select('year, set_name, insert_name, card_number, player, team, sport, is_rookie, source, source_url')
  if (error) throw error
  return data as Entry[]
}

/** Remembers checklist searches that settled a card. A spot already known (e.g. from a saved card) wins. */
async function rememberSearches(supabase: SupabaseClient, entries: Entry[]) {
  if (entries.length === 0) return
  const { error } = await supabase
    .from('checklist_entries')
    .upsert(entries, { onConflict: 'user_id,spot_key', ignoreDuplicates: true })
  if (error) console.error('checklist_entries upsert failed', error)
}

/** Every set's parallel list (public.set_parallels); small enough to load whole. */
async function loadRainbow(supabase: SupabaseClient): Promise<Rainbow[]> {
  const { data, error } = await supabase
    .from('set_parallels')
    .select('year, set_name, insert_name, parallel, print_run, source, source_url')
  if (error) throw error
  return data as Rainbow[]
}

/** Saves parallels a search found. Anything already known (from a saved card, by hand, or earlier) wins. */
async function rememberParallels(supabase: SupabaseClient, rows: Rainbow[]) {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('set_parallels')
    .upsert(rows, { onConflict: 'user_id,parallel_key', ignoreDuplicates: true })
  if (error) console.error('set_parallels upsert failed', error)
}

/** Falls back to the app_settings column default for a collector who never opened the settings. */
async function autoLookup(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from('app_settings').select('auto_lookup').maybeSingle()
  return data?.auto_lookup ?? true
}

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
    if (body.action === 'parallels' && Array.isArray(body.sets)) {
      const model = isModel(body.model) ? body.model : DEFAULT_MODEL
      return json(await fetchParallels(supabase, anthropic, model, body.sets, body.now === true))
    }
    if (body.action === 'poll_parallels') return json(await pollParallels(supabase, anthropic))
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
  const spent: UsageRow[] = []
  const lookUpNow = scans.some((s) => s.status === 'processing') ? await autoLookup(supabase) : false
  const learned: Entry[] = []
  const learnedParallels: Rainbow[] = []
  let checklist: Entry[] | null = null
  const cached = async () => (checklist ??= await loadChecklist(supabase))
  let rainbow: Rainbow[] | null = null
  const parallels = async () => (rainbow ??= await loadRainbow(supabase))
  for (const batchId of batchIds) {
    const batch = await anthropic.messages.batches.retrieve(batchId)
    if (batch.processing_status !== 'ended') {
      stillProcessing += scans.filter((s) => s.batch_id === batchId).length
      continue
    }
    for await (const result of await anthropic.messages.batches.results(batchId)) {
      const scan = byId.get(result.custom_id)
      if (result.result.type === 'succeeded') {
        spent.push(usageRow(scan?.status === 'looking_up' ? 'lookup' : 'read', result.result.message, true))
      }
      if (!scan) continue // reviewed or deleted meanwhile
      if (scan.status === 'looking_up') {
        const { update, setParallels } = toLookupUpdate(result, scan.extraction as Reading)
        // Only if still waiting: the card may have been saved while the lookup ran.
        const { error: updateError } = await supabase
          .from('card_scans')
          .update(update)
          .eq('id', scan.id)
          .eq('status', 'looking_up')
        if (updateError) throw updateError
        const lookup = (update.extraction as { lookup?: Record<string, unknown> }).lookup
        const entry = lookup?.fields
          ? entryFromSearch(
              lookup.fields as Record<string, unknown>,
              (lookup.still_uncertain as string[]) ?? [],
              (lookup.sources as { url: string }[] | undefined)?.[0]?.url ?? null,
            )
          : null
        if (entry) learned.push(entry)
        const fields = lookup?.fields as Record<string, unknown> | undefined
        if (setParallels.length && typeof fields?.year === 'string' && typeof fields?.set_name === 'string') {
          const source = (lookup?.sources as { url: string }[] | undefined)?.[0]?.url ?? null
          learnedParallels.push(...rowsFromSearch(fields.year, fields.set_name, setParallels, source))
        }
      } else {
        const update = toScanUpdate(result)
        // The set's parallel list goes first: a print run it knows can settle the parallel for free.
        if (update.status === 'ready' && update.extraction) {
          const settled = settleParallel(update.extraction as Reading, await parallels())
          if (settled) update.extraction = { ...settled.reading, rainbow: settled.rainbow }
        }
        const next = update.status === 'ready' ? triage(update.extraction as Reading) : null
        if (next) update.extraction = { ...update.extraction, triage: next }
        // With automatic lookups off, the card waits in review with a "Check checklist" button instead.
        // Otherwise the checklist cache goes first: if it settles every doubt, no web search is needed.
        if (next === 'lookup' && lookUpNow) {
          const fromCache = resolveFromCache(update.extraction as Reading, await cached(), FIELDS)
          if (fromCache) update.extraction = { ...update.extraction, lookup: fromCache }
          else Object.assign(update, { status: 'looking_up', batch_id: null })
        }
        // Claiming the row by its status means two polls at once can't both send its lookup.
        const { data: claimed, error: updateError } = await supabase
          .from('card_scans')
          .update(update)
          .eq('id', scan.id)
          .eq('status', 'processing')
          .select('id')
        if (updateError) throw updateError
        if (update.status === 'looking_up' && claimed.length) {
          toLookUp.push({ ...scan, extraction: update.extraction as Reading })
        }
      }
      updated++
    }
  }

  await logUsage(supabase, spent)
  await rememberSearches(supabase, learned)
  await rememberParallels(supabase, learnedParallels)
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
  if (scans.length === 0) return { submitted: 0 }
  // Cards the set's parallel list or the checklist cache can settle don't need a web search.
  const checklist = await loadChecklist(supabase)
  const rainbow = await loadRainbow(supabase)
  const toSearch: ScanWithReading[] = []
  for (const scan of scans) {
    const settled = settleParallel(scan.extraction, rainbow)
    const reading = settled ? { ...settled.reading, rainbow: settled.rainbow } : scan.extraction
    const nothingLeft = settled?.rainbow.kind === 'settled' && !settled.reading.uncertain_fields?.length
    const fromCache = nothingLeft ? null : resolveFromCache(reading, checklist, FIELDS)
    if (!nothingLeft && !fromCache) {
      toSearch.push({ ...scan, extraction: reading })
      continue
    }
    const { error: updateError } = await supabase
      .from('card_scans')
      .update({ status: 'ready', extraction: fromCache ? { ...reading, lookup: fromCache } : reading })
      .eq('id', scan.id)
    if (updateError) throw updateError
  }
  if (toSearch.length) await sendLookupsOrRelease(supabase, anthropic, toSearch)
  return { submitted: toSearch.length, cached: scans.length - toSearch.length }
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
  const checklist = await loadChecklist(supabase)
  const rainbow = await loadRainbow(supabase)
  const batch = await anthropic.messages.batches.create({
    requests: scans.map((scan) => {
      const model = isModel(scan.extraction.model) ? scan.extraction.model : DEFAULT_MODEL
      const hint = [cacheHint(findSpot(scan.extraction, checklist)), rainbowHint(scan.extraction, rainbow)]
        .filter(Boolean)
        .join(' ')
      // Without a parallel list for this set yet, the search brings one back if it comes across it.
      const askForParallels = !hasList(scan.extraction, rainbow)
      return {
        custom_id: scan.id,
        params: {
          model,
          max_tokens: 16000,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          ...thinking(model),
          ...(model === 'claude-haiku-4-5' ? {} : { output_config: effort(model) }),
          tools: [searchTool(model), RECORD_CARD_TOOL],
          messages: [
            {
              role: 'user',
              content: [
                ...photoBlocks(scan, urls),
                { type: 'text', text: lookupInstructions(scan.extraction, hint, askForParallels) },
              ],
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

type ParallelGroup = { insert_name?: unknown; parallels?: unknown }

/**
 * Folds the checklist pass into the reading. Whatever happens, the card lands in review: never another
 * lookup. Also returns the set's parallel list, when the search was asked for it and found one.
 */
function toLookupUpdate(
  result: Anthropic.Messages.MessageBatchIndividualResponse,
  reading: Reading,
): { update: { status: string; extraction: Record<string, unknown> }; setParallels: ParallelGroup[] } {
  const done = (lookup: Record<string, unknown>, setParallels: ParallelGroup[] = []) => ({
    update: { status: 'ready', extraction: { ...reading, lookup } },
    setParallels,
  })
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

  const sources = sourcesFrom(message, input)

  const fields = Object.fromEntries(FIELDS.map((f) => [f, input[f]]))
  const changed = FIELDS.filter((f) => normalize(input[f]) !== normalize(reading[f]))
  return done(
    {
      ...cost,
      fields,
      changed,
      confirmed: input.confirmed_fields ?? [],
      still_uncertain: input.still_uncertain ?? [],
      sources,
      notes: input.notes ?? '',
    },
    Array.isArray(input.set_parallels) ? (input.set_parallels as ParallelGroup[]) : [],
  )
}

/** The links the model relied on, kept only if they really came back from a search, with their page titles. */
function sourcesFrom(message: Anthropic.Messages.Message, input: Record<string, unknown>) {
  const seen = new Map<string, string>()
  for (const block of message.content as unknown as { type: string; content?: unknown }[]) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue
    for (const hit of block.content as { url?: string; title?: string }[]) {
      if (hit.url) seen.set(hit.url, hit.title ?? hit.url)
    }
  }
  return ((input.source_urls as string[] | undefined) ?? [])
    .filter((url) => seen.has(url))
    .slice(0, 3)
    .map((url) => ({ url, title: seen.get(url) }))
}

/** Dynamic filtering trims search results before they reach the model; Haiku 4.5 predates it. */
function searchTool(model: Model) {
  return model === 'claude-haiku-4-5'
    ? { type: 'web_search_20250305', name: 'web_search', max_uses: LOOKUP_MAX_SEARCHES }
    : { type: 'web_search_20260209', name: 'web_search', max_uses: LOOKUP_MAX_SEARCHES }
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

// ---- Set parallel lists ----

type SetRef = { year: string; set_name: string }
type FetchRow = { id: string; year: string; set_name: string; status: string; batch_id: string | null; found: number | null }

const setKey = (s: SetRef) => `${s.year}|${s.set_name}`.toLowerCase().replace(/[^a-z0-9|]/g, '')
const setRefOf = (row: SetRef): SetRef => ({ year: row.year, set_name: row.set_name })

/**
 * Fetches each set's parallel list with one web-search request per set. Sets being fetched, or already
 * fetched with results, are skipped. `now` answers right away (the card form waits for it); otherwise
 * the requests go out as a half-price batch that pollParallels collects.
 */
async function fetchParallels(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  model: Model,
  requested: unknown[],
  now: boolean,
) {
  const sets = new Map<string, SetRef>()
  for (const item of requested as Partial<SetRef>[]) {
    const year = typeof item?.year === 'string' ? item.year.trim() : ''
    const setName = typeof item?.set_name === 'string' ? item.set_name.trim() : ''
    if (year && setName) sets.set(setKey({ year, set_name: setName }), { year, set_name: setName })
  }
  const { data: existing, error } = await supabase.from('parallel_fetches').select('year, set_name, status, found')
  if (error) throw error
  for (const row of existing) {
    if (row.status === 'pending' || (row.status === 'done' && (row.found ?? 0) > 0)) sets.delete(setKey(row))
  }
  const todo = [...sets.values()]
  if (todo.length === 0) return { submitted: 0, results: [] }

  const { data: claimed, error: claimError } = await supabase
    .from('parallel_fetches')
    .upsert(
      todo.map((s) => ({ ...s, status: 'pending', batch_id: null, found: null, notes: null, error: null })),
      { onConflict: 'user_id,set_key' },
    )
    .select('id, year, set_name, status, batch_id, found')
  if (claimError) throw claimError
  const rows = claimed as FetchRow[]
  const inserts = await insertNamesBySet(supabase)

  if (now) {
    const results = await Promise.all(rows.map((row) => fetchOneNow(supabase, anthropic, model, row, inserts)))
    return { submitted: rows.length, results }
  }
  try {
    const batch = await anthropic.messages.batches.create({
      requests: rows.map((row) => ({
        custom_id: row.id,
        params: parallelsRequest(model, row, inserts),
      })) as unknown as Anthropic.Messages.BatchCreateParams.Request[],
    })
    const { error: updateError } = await supabase
      .from('parallel_fetches')
      .update({ batch_id: batch.id })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    if (updateError) throw updateError
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    await supabase
      .from('parallel_fetches')
      .update({ status: 'failed', error: `The search couldn’t start (${message}).` })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    throw err
  }
  return { submitted: rows.length, results: [] }
}

function parallelsRequest(model: Model, set: SetRef, inserts: Map<string, string[]>) {
  return {
    model,
    max_tokens: 16000,
    system: 'You research sports trading card checklists for a collector.',
    ...thinking(model),
    ...(model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' } }),
    tools: [searchTool(model), RECORD_PARALLELS_TOOL],
    messages: [
      {
        role: 'user' as const,
        content: parallelsInstructions(set.year, set.set_name, inserts.get(setKey(set)) ?? []),
      },
    ],
  }
}

/** One set, answered right away. A long search can pause mid-turn; it's continued a few times. */
async function fetchOneNow(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  model: Model,
  row: FetchRow,
  inserts: Map<string, string[]>,
) {
  const request = parallelsRequest(model, row, inserts)
  const messages: Anthropic.Messages.MessageParam[] = [...request.messages]
  const spent: UsageRow[] = []
  try {
    let message: Anthropic.Messages.Message | null = null
    for (let turn = 0; turn < 4; turn++) {
      message = (await anthropic.messages.create({
        ...request,
        messages,
      } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Messages.Message
      spent.push(usageRow('parallels', message, false))
      if (message.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: message.content })
    }
    return await finishFetch(supabase, row, message!)
  } catch (err) {
    console.error(err)
    const error = `The search failed (${err instanceof Error ? err.message : 'unknown error'}).`
    await supabase.from('parallel_fetches').update({ status: 'failed', error }).eq('id', row.id)
    return { ...setRefOf(row), found: 0, error }
  } finally {
    await logUsage(supabase, spent)
  }
}

/** Saves what a parallel-list search recorded and closes its fetch row. */
async function finishFetch(supabase: SupabaseClient, row: FetchRow, message: Anthropic.Messages.Message) {
  const call = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use' && block.name === 'record_parallels',
  )
  if (!call) {
    const error = 'The search didn’t finish.'
    await supabase.from('parallel_fetches').update({ status: 'failed', error }).eq('id', row.id)
    return { ...setRefOf(row), found: 0, error }
  }
  const input = call.input as Record<string, unknown>
  const source = sourcesFrom(message, input)[0]?.url ?? null
  const groups = Array.isArray(input.groups) ? (input.groups as ParallelGroup[]) : []
  const rows = rowsFromSearch(row.year, row.set_name, groups, source)
  await rememberParallels(supabase, rows)
  const notes = typeof input.notes === 'string' ? input.notes : ''
  await supabase
    .from('parallel_fetches')
    .update({ status: 'done', found: rows.length, notes, error: null })
    .eq('id', row.id)
  return { ...setRefOf(row), found: rows.length, notes }
}

/** Collects finished parallel-list batches. Fetches claimed but never sent are released as failed. */
async function pollParallels(supabase: SupabaseClient, anthropic: Anthropic) {
  const { data, error } = await supabase
    .from('parallel_fetches')
    .select('id, year, set_name, status, batch_id, found, updated_at')
    .eq('status', 'pending')
  if (error) throw error
  const pending = data as (FetchRow & { updated_at: string })[]
  const cutoff = Date.now() - STUCK_LOOKUP_MS
  for (const row of pending) {
    if (row.batch_id || Date.parse(row.updated_at) > cutoff) continue
    await supabase
      .from('parallel_fetches')
      .update({ status: 'failed', error: 'The search didn’t start.' })
      .eq('id', row.id)
      .eq('status', 'pending')
  }
  const byId = new Map(pending.map((r) => [r.id, r]))
  const spent: UsageRow[] = []
  let stillPending = 0
  let updated = 0
  for (const batchId of [...new Set(pending.map((r) => r.batch_id).filter(Boolean))] as string[]) {
    const batch = await anthropic.messages.batches.retrieve(batchId)
    if (batch.processing_status !== 'ended') {
      stillPending += pending.filter((r) => r.batch_id === batchId).length
      continue
    }
    for await (const result of await anthropic.messages.batches.results(batchId)) {
      const row = byId.get(result.custom_id)
      if (!row) continue
      if (result.result.type === 'succeeded') {
        spent.push(usageRow('parallels', result.result.message, true))
        await finishFetch(supabase, row, result.result.message)
      } else {
        await supabase
          .from('parallel_fetches')
          .update({ status: 'failed', error: failureReason(result) })
          .eq('id', row.id)
      }
      updated++
    }
  }
  await logUsage(supabase, spent)
  return { updated, pending: stillPending }
}

/** The insert names the collector already uses, per set, so a fetched list reuses their spelling. */
async function insertNamesBySet(supabase: SupabaseClient): Promise<Map<string, string[]>> {
  const { data, error } = await supabase.from('cards').select('year, set_name, insert_name').limit(5000)
  if (error) throw error
  const bySet = new Map<string, Set<string>>()
  for (const card of data as (SetRef & { insert_name: string | null })[]) {
    const name = card.insert_name?.trim()
    if (!name) continue
    const key = setKey(card)
    bySet.set(key, (bySet.get(key) ?? new Set<string>()).add(name))
  }
  return new Map([...bySet].map(([key, names]) => [key, [...names]]))
}
