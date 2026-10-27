import { zodResolver } from '@hookform/resolvers/zod'
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Field, inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ToggleChip } from '../../components/ToggleChip'
import { buttonPrimary, buttonSecondary, panel, sectionTitle } from '../../components/ui'
import type { Card } from '../../types/card'
import { cardFormSchema, stickyForm, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle, setNameWarning } from './cardText'
import { cardNumberFill, fieldName, fillFromCollection, type Spot } from './autofill'
import { DuplicateNotice, DuplicatePrompt } from './DuplicateNotice'
import { findDuplicates, type DuplicateMatch } from './duplicates'
import { ParallelPicker } from './ParallelPicker'
import {
  cardNumbering,
  hasParallelList,
  matchParallel,
  parallelOptions,
  parallelSuggestions,
  type ParallelOption,
  type SetParallel,
} from './parallels'
import { QuickEntry, type QuickResult } from './QuickEntry'
import { buildQuickContext, parseCardText } from './spokenCard'
import { SetSection } from './SetSection'
import { standardTeam } from './teams'
import type { SetHelp } from '../sets/useSetHelp'

/** How long the set fields rest before the form loads what's known about that set. */
const SET_SETTLE_MS = 400

export type SuggestionField =
  | 'player'
  | 'year'
  | 'set_name'
  | 'insert_name'
  | 'parallel'
  | 'sport'
  | 'team'
  | 'grade_company'
  | 'raw_condition'
export type Suggestions = Partial<Record<SuggestionField, string[]>>

type TextFieldName = {
  [K in keyof CardFormValues]: CardFormValues[K] extends string ? K : never
}[keyof CardFormValues]

const FLAGS = [
  ['is_rookie', 'RC'],
  ['is_auto', 'Auto'],
  ['is_relic', 'Relic'],
  ['is_graded', 'Graded'],
] as const

/** Names typed fast: iOS autocorrect turns players and sets into other words. */
const NAME_INPUT = { autoCorrect: 'off', spellCheck: false, autoCapitalize: 'words' } as const

const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

type CardFormProps = {
  initialValues: CardFormValues
  suggestions: Suggestions
  /** "new" shows Save & add another and the voice box; "edit" shows a single Save changes button. */
  mode: 'new' | 'edit'
  /** `mergeInto` is set when the collector chose to add this copy to an existing card's quantity. */
  onSubmit: (values: CardFormValues, options: { addAnother: boolean; mergeInto?: Card }) => Promise<void>
  /** Extra content after the fields, e.g. the delete button on the edit page. */
  footer?: ReactNode
  /** Label for the single button in "edit" mode. */
  submitLabel?: string
  /** A scan found no serial number: the parallel picker leads with the unnumbered parallels. */
  unnumbered?: boolean
  /** Per-field notes shown as warnings, e.g. fields the AI was unsure about. */
  fieldNotes?: Partial<Record<keyof CardFormValues, string>>
  /** The collection, to flag cards already in it. `askOnSave` offers to merge plain extra copies. */
  duplicates?: { cards: Card[]; excludeId?: string; askOnSave: boolean }
  /**
   * Fill blank fields from matching cards in the collection (and the set's checklist, with `setHelp`)
   * when Player, Year, Set or Card # is left.
   */
  autofillFrom?: Spot[]
  /**
   * The set's parallel list and checklist (useSetHelp): fills the parallel from the print run (or back)
   * and Card # from the player, and flags mismatches. A baseball set is looked up on Baseball Cardpedia,
   * free, the first time.
   */
  setHelp?: SetHelp
  /** Set names the card database knows (the Sets page), so a spoken set is recognized before any card from it is saved. */
  knownSets?: string[]
  /** A paid lookup of a set's parallel list, offered when none is known. Resolves with the fresh list. */
  lookUpParallels?: {
    run: (year: string, setName: string) => Promise<SetParallel[] | null>
    busy: boolean
    cost: string
    error: string | null
  }
}

type PendingSave = { values: CardFormValues; addAnother: boolean; match: DuplicateMatch }

export function CardForm({
  initialValues,
  suggestions,
  mode,
  onSubmit,
  footer,
  submitLabel = 'Save changes',
  unnumbered = false,
  fieldNotes = {},
  duplicates,
  autofillFrom,
  setHelp,
  knownSets,
  lookUpParallels,
}: CardFormProps) {
  const setParallels = setHelp?.parallels
  const spots = setHelp?.spots
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setFocus,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CardFormValues>({ resolver: zodResolver(cardFormSchema), defaultValues: initialValues })
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [saving, setSaving] = useState(false)
  const [filledNote, setFilledNote] = useState<string | null>(null)
  // Shown only while the filled value is still there.
  const [parallelNote, setParallelNote] = useState<{ field: 'parallel' | 'print_run'; value: string; text: string } | null>(
    null,
  )
  // After Save & add another the batch's set folds to one line; the voice box keeps focus if it was used.
  const [setOpen, setSetOpen] = useState(true)
  const [usedVoice, setUsedVoice] = useState(false)
  const quickRef = useRef<HTMLInputElement>(null)
  // Counts Save & add another, to put the cursor back for the next card.
  const [saved, setSaved] = useState(0)
  useEffect(() => {
    if (!saved) return
    if (usedVoice) quickRef.current?.focus()
    else setFocus('player')
  }, [saved, usedVoice, setFocus])

  // Success toasts fade out on their own; errors stay until the next save attempt.
  useEffect(() => {
    if (status?.kind !== 'ok') return
    const timer = window.setTimeout(() => setStatus(null), 4000)
    return () => window.clearTimeout(timer)
  }, [status])

  const [setName, sport, isRookie, isAuto, isRelic, isGraded] = useWatch({
    control,
    name: ['set_name', 'sport', 'is_rookie', 'is_auto', 'is_relic', 'is_graded'],
  })
  const [player, year, insertName, parallel, cardNumber, serial, printRun, cert] = useWatch({
    control,
    name: ['player', 'year', 'insert_name', 'parallel', 'card_number', 'serial_number', 'print_run', 'cert_number'],
  })

  // Once the set fields settle, load what's known about that set (latest setHelp, without re-running).
  const help = useRef(setHelp)
  useEffect(() => {
    help.current = setHelp
  })
  useEffect(() => {
    const timer = window.setTimeout(
      () => help.current?.onSetChange({ year, set_name: setName, sport }),
      SET_SETTLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [year, setName, sport])

  const spot = { year, set_name: setName, insert_name: insertName }
  const parallelMatch = setParallels ? matchParallel(setParallels, { ...spot, parallel, print_run: printRun }) : null
  const rainbow = setParallels ? parallelOptions(setParallels, { ...spot, parallel, print_run: printRun }) : []
  // The player's cards in this set, by checklist: one tap fills Card #.
  const numberMatch = spots
    ? cardNumberFill(
        { ...initialValues, player, year, set_name: setName, insert_name: insertName, card_number: '', is_rookie: isRookie },
        spots,
      )
    : null
  const numberOptions = numberMatch?.options ?? []
  const showNumbers =
    numberOptions.length > 1 || (numberOptions.length === 1 && norm(cardNumber) !== norm(numberOptions[0].card_number))
  const offerLookup =
    lookUpParallels &&
    setParallels &&
    !setHelp?.busy &&
    year.trim() &&
    setName.trim() &&
    (printRun.trim() || parallel.trim()) &&
    !hasParallelList(setParallels, year, setName)

  // The set's checklist players first, then the collection's; memoized, since a checklist can run to thousands.
  const lists = useMemo(() => {
    const own = spots?.length ? spots.map((s) => s.player) : []
    const players = own.length ? [...new Set([...own, ...(suggestions.player ?? [])])] : suggestions.player
    return { ...suggestions, player: players }
  }, [spots, suggestions])
  const parallelList = useMemo(
    () => (setParallels ? parallelSuggestions(setParallels, { year, set_name: setName, insert_name: insertName }, suggestions.parallel ?? []) : suggestions.parallel),
    [setParallels, year, setName, insertName, suggestions.parallel],
  )

  const matches = duplicates
    ? findDuplicates(
        {
          player,
          year,
          set_name: setName,
          insert_name: insertName,
          parallel,
          card_number: cardNumber,
          serial_number: /^\d+$/.test(serial.trim()) ? Number(serial.trim()) : null,
          is_graded: isGraded,
          cert_number: cert,
        },
        duplicates.cards,
        duplicates.excludeId,
      )
    : []
  const flagValues = { is_rookie: isRookie, is_auto: isAuto, is_relic: isRelic, is_graded: isGraded }
  const hasMoney = Boolean(
    initialValues.purchase_price || initialValues.estimated_value || initialValues.sold_price,
  )
  const setFolded = mode === 'new' && !setOpen && !errors.year && !errors.set_name && !errors.sport

  async function save(formValues: CardFormValues, addAnother: boolean, mergeInto?: Card) {
    setStatus(null)
    setPending(null)
    setSaving(true)
    try {
      await onSubmit(formValues, { addAnother, mergeInto })
      if (addAnother) {
        const title = cardTitle(toCardInput(formValues))
        setStatus({ kind: 'ok', text: mergeInto ? `Added to quantity: ${title}` : `Saved: ${title}` })
        reset(stickyForm(formValues))
        setFilledNote(null)
        setParallelNote(null)
        setSetOpen(false)
        window.scrollTo({ top: 0 })
        setSaved((n) => n + 1)
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  const submit = (addAnother: boolean) =>
    handleSubmit(async (formValues) => {
      // Ask first when this is a plain extra copy (merge?) or looks like a card entered twice.
      const ask = duplicates?.askOnSave
        ? findDuplicates(toCardInput(formValues), duplicates.cards, duplicates.excludeId).find(
            (m) => m.kind !== 'other-copy',
          )
        : undefined
      if (ask) {
        setPending({ values: formValues, addAnother, match: ask })
        return
      }
      await save(formValues, addAnother)
    })
  const busy = isSubmitting || saving

  function apply(values: Partial<CardFormValues>) {
    // A team from the checklist or the voice box comes in as the collection spells it ("Reds" is "Cincinnati Reds").
    if (values.team) values = { ...values, team: teamName(values.team, { ...getValues(), ...values }) }
    for (const [field, value] of Object.entries(values)) {
      setValue(field as keyof CardFormValues, value as never, { shouldDirty: true })
    }
  }

  /**
   * Free: fill blanks from the set's checklist (Card # from the player) and the collection (the player
   * from Card #, team and sport) when an identifying field is left, then the parallel from the print run.
   */
  async function autofill(): Promise<string[]> {
    const known = setHelp ? await setHelp.load(getValues()) : null
    const filled: string[] = []
    const notes: string[] = []
    const byNumber = known && cardNumberFill(getValues(), known.spots)
    if (byNumber?.fill) {
      apply(byNumber.fill.values)
      filled.push(...byNumber.fill.fields)
      notes.push(`Filled ${byNumber.fill.fields.map(fieldName).join(', ')} from ${byNumber.fill.source}.`)
    }
    if (autofillFrom) {
      const fill = fillFromCollection(getValues(), [...autofillFrom, ...(known?.spots ?? [])])
      if (fill) {
        apply(fill.values)
        filled.push(...fill.fields)
        notes.push(`Filled ${fill.fields.map(fieldName).join(', ')} from ${fill.source}.`)
      }
    }
    if (notes.length) setFilledNote(notes.join(' '))
    if (known) filled.push(...fillParallel(known.parallels))
    return filled
  }

  function teamName(team: string, card: { year: string; sport: string }) {
    return standardTeam(team, { year: card.year, sport: card.sport, known: suggestions.team })
  }

  function tidyTeam() {
    const team = getValues('team')
    const tidy = teamName(team, getValues())
    if (tidy !== team) apply({ team: tidy })
  }

  async function refillParallel(options: { from?: 'parallel' | 'print_run' } = {}) {
    if (setHelp) fillParallel((await setHelp.load(getValues())).parallels, options)
  }

  // Free: the set's parallel list names the parallel from its print run, or the print run from the parallel.
  // Leaving one of the two fills only the other, so a field cleared on purpose stays blank.
  function fillParallel(list: SetParallel[], { from }: { from?: 'parallel' | 'print_run' } = {}): string[] {
    const match = matchParallel(list, getValues())
    if (match?.kind === 'fill' && from !== 'parallel') {
      apply({ parallel: match.parallel })
      setParallelNote({ field: 'parallel', value: match.parallel, text: `Filled Parallel: ${match.parallel}, ${match.text}.` })
      return ['parallel']
    }
    if (match?.kind === 'printRun' && from !== 'print_run') {
      apply({ print_run: String(match.printRun) })
      setParallelNote({ field: 'print_run', value: String(match.printRun), text: `Filled the print run: ${match.text}.` })
      return ['print_run']
    }
    return []
  }

  async function lookUpSetParallels() {
    const list = await lookUpParallels?.run(year.trim(), setName.trim())
    if (list) fillParallel(list)
  }

  // A chip sets the parallel and, when it's numbered, the print run; a mismatch left over shows as a warning.
  function pickParallel(option: ParallelOption | null) {
    apply({ parallel: option?.parallel ?? '' })
    if (option?.print_run != null) apply({ print_run: String(option.print_run) })
    setParallelNote(null)
  }

  function pickNumber(option: Spot) {
    apply({ card_number: option.card_number, insert_name: option.insert_name ?? '' })
    if (option.is_rookie) apply({ is_rookie: true })
    if (option.player !== player.trim()) apply({ player: option.player })
    void refillParallel()
  }

  /** The voice box: read the sentence against what's known, then against its set's own checklist and rainbow. */
  async function quickFill(text: string): Promise<QuickResult> {
    setUsedVoice(true)
    const collection = {
      sets: [...new Set([...(suggestions.set_name ?? []), ...(knownSets ?? [])])],
      inserts: suggestions.insert_name ?? [],
      parallels: suggestions.parallel ?? [],
      teams: suggestions.team ?? [],
      sports: suggestions.sport ?? [],
      players: suggestions.player ?? [],
    }
    const current = getValues()
    const first = parseCardText(text, buildQuickContext(collection, { parallels: setParallels ?? [], spots: spots ?? [] }, current.insert_name))
    const target = {
      year: first.values.year ?? current.year,
      set_name: first.values.set_name ?? current.set_name,
      sport: first.values.sport ?? current.sport,
    }
    const known = setHelp ? await setHelp.load(target) : null
    const read = known
      ? parseCardText(text, buildQuickContext(collection, known, first.values.insert_name ?? current.insert_name))
      : first
    // A new player starts over on what belongs to the last one.
    if (read.values.player && norm(read.values.player) !== norm(current.player) && !read.values.card_number) {
      apply({ card_number: '' })
    }
    apply(read.values)
    const filled = await autofill()
    const fields = [...new Set([...read.placed, ...filled])]
    return { filled: fields.map(fieldName), leftover: read.leftover }
  }

  // Enter moves to the next field, as the keyboard's "next" key says; the buttons save.
  function nextField(e: KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement
    if (e.key !== 'Enter' || target.tagName !== 'INPUT' || target.id === 'quick-entry') return
    e.preventDefault()
    const fields = [...e.currentTarget.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([disabled])')].filter(
      (el) => el.id !== 'quick-entry' && el.offsetParent !== null,
    )
    fields[fields.indexOf(target as HTMLInputElement) + 1]?.focus()
  }

  function textInput(
    name: TextFieldName,
    props: InputHTMLAttributes<HTMLInputElement> & { list?: SuggestionField } = {},
  ) {
    const { list, onBlur, ...rest } = props
    const field = register(name)
    return (
      <input
        id={name}
        autoComplete="off"
        enterKeyHint="next"
        list={list ? `suggest-${list}` : undefined}
        className={inputClass}
        aria-invalid={errors[name] ? true : undefined}
        {...rest}
        {...field}
        onBlur={(e) => {
          void field.onBlur(e)
          onBlur?.(e)
        }}
      />
    )
  }

  return (
    <form onSubmit={submit(mode === 'new')} onKeyDown={nextField} noValidate className="flex flex-col gap-4 pb-28">
      <Datalists lists={lists} parallels={parallelList} />

      {status && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <p
            role="status"
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-2xl shadow-black/60 ${
              status.kind === 'ok' ? 'bg-ink-50 text-ink-950' : 'bg-red-500 text-white'
            }`}
          >
            {status.kind === 'ok' && <Icon name="check" size={18} className="mt-px shrink-0" />}
            {status.text}
          </p>
        </div>
      )}

      {mode === 'new' && <QuickEntry onFill={quickFill} inputRef={quickRef} />}

      <SetSection
        open={!setFolded}
        summary={[year, setName, sport].map((s) => s.trim()).filter(Boolean).join(' · ')}
        onOpen={() => {
          setSetOpen(true)
          window.setTimeout(() => setFocus('set_name'))
        }}
        status={setHelp?.status ?? null}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Year"
            htmlFor="year"
            required
            error={errors.year?.message}
            warning={fieldNotes.year}
            hint="e.g. 2023 or 2023-24"
          >
            {textInput('year', {
              list: 'year',
              autoFocus: mode === 'new' && !initialValues.year,
              onBlur: () => void autofill(),
            })}
          </Field>
          <Field label="Sport" htmlFor="sport" required error={errors.sport?.message} warning={fieldNotes.sport}>
            {textInput('sport', { list: 'sport', ...NAME_INPUT })}
          </Field>
          <Field
            label="Set"
            htmlFor="set_name"
            required
            error={errors.set_name?.message}
            warning={fieldNotes.set_name ?? setNameWarning(setName)}
            hint="The product, no year or color: Topps Finest, Bowman Chrome, Panini Prizm"
            className="col-span-2"
          >
            {textInput('set_name', { list: 'set_name', ...NAME_INPUT, onBlur: () => void autofill() })}
          </Field>
        </div>
      </SetSection>

      <FormSection title="Card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Player"
            htmlFor="player"
            required
            error={errors.player?.message}
            warning={fieldNotes.player}
            className="col-span-2"
          >
            {textInput('player', {
              list: 'player',
              ...NAME_INPUT,
              autoFocus: mode === 'new' && Boolean(initialValues.year),
              onBlur: () => void autofill(),
            })}
          </Field>
          <Field
            label="Card #"
            htmlFor="card_number"
            required
            error={errors.card_number?.message}
            warning={fieldNotes.card_number}
            hint={spots?.length ? 'Fills in from the checklist' : undefined}
          >
            {textInput('card_number', {
              autoCapitalize: 'characters',
              autoCorrect: 'off',
              spellCheck: false,
              onBlur: () => void autofill(),
            })}
          </Field>
          <Field label="Team" htmlFor="team" warning={fieldNotes.team}>
            {textInput('team', { list: 'team', ...NAME_INPUT, onBlur: tidyTeam })}
          </Field>
          {showNumbers && (
            <div className="col-span-2 flex flex-col gap-2 sm:col-span-4">
              <p className="text-xs text-ink-400">
                {numberOptions[0].player}’s {numberOptions.length === 1 ? 'card' : 'cards'} in this set:
              </p>
              <div className="flex flex-wrap gap-2">
                {numberOptions.map((option) => {
                  const chosen = norm(option.card_number) === norm(cardNumber) && norm(option.insert_name) === norm(insertName)
                  return (
                    <button
                      key={`${option.insert_name}|${option.card_number}`}
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`#${option.card_number}, ${option.insert_name || 'base'}`}
                      onClick={() => pickNumber(option)}
                      className={`min-h-11 rounded-full px-3.5 text-sm font-medium ${
                        chosen ? 'bg-accent-400 text-ink-950' : 'bg-ink-900 text-ink-200 ring-1 ring-ink-700 ring-inset active:bg-ink-800'
                      }`}
                    >
                      #{option.card_number}
                      <span className={chosen ? 'text-ink-800' : 'text-ink-400'}> · {option.insert_name || 'base'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <Field
            label="Insert"
            htmlFor="insert_name"
            warning={fieldNotes.insert_name}
            hint="Named subset, blank for base: Rookie Autographs, Future Stars"
            className="col-span-2"
          >
            {textInput('insert_name', { list: 'insert_name', ...NAME_INPUT, onBlur: () => void refillParallel() })}
          </Field>
        </div>
        {filledNote && <p className="mt-3 text-xs text-accent-300">{filledNote}</p>}
      </FormSection>

      <FormSection title="Version">
        <div className="flex flex-col gap-4">
          <Field
            label="Parallel"
            htmlFor="parallel"
            warning={fieldNotes.parallel ?? (parallelMatch?.kind === 'conflict' ? parallelMatch.text : undefined)}
            hint="Color or finish, blank for base: Refractor, Red Refractor, Silver"
          >
            {textInput('parallel', {
              list: 'parallel',
              ...NAME_INPUT,
              onBlur: () => void refillParallel({ from: 'parallel' }),
            })}
          </Field>
          <ParallelPicker
            options={rainbow}
            base={!parallel.trim()}
            numbering={cardNumbering(printRun, unnumbered)}
            onPick={pickParallel}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-400">Serial numbered</span>
            <div className="flex items-center gap-2">
              <input
                id="serial_number"
                aria-label="Serial number"
                inputMode="numeric"
                enterKeyHint="next"
                placeholder="23"
                className={inputClass}
                {...register('serial_number')}
              />
              <span className="text-lg text-ink-500">/</span>
              <input
                id="print_run"
                aria-label="Print run"
                inputMode="numeric"
                enterKeyHint="next"
                placeholder="99"
                className={inputClass}
                {...register('print_run', { onBlur: () => void refillParallel({ from: 'print_run' }) })}
              />
            </div>
            {errors.serial_number || errors.print_run ? (
              <p className="text-xs text-red-400">{errors.serial_number?.message ?? errors.print_run?.message}</p>
            ) : fieldNotes.serial_number || fieldNotes.print_run ? (
              <p className="text-xs text-amber-300">{fieldNotes.serial_number ?? fieldNotes.print_run}</p>
            ) : (
              <p className="text-xs text-ink-500">Leave the first box blank if you only know the print run</p>
            )}
          </div>
        </div>
        {parallelNote && (parallelNote.field === 'parallel' ? parallel : printRun) === parallelNote.value && (
          <p className="mt-3 text-xs text-accent-300">{parallelNote.text}</p>
        )}
        {offerLookup && (
          <div className="mt-3 flex flex-col gap-1">
            <button
              type="button"
              disabled={lookUpParallels?.busy}
              onClick={() => void lookUpSetParallels()}
              className={`${buttonSecondary} min-h-11 self-start text-sm`}
            >
              {lookUpParallels?.busy
                ? 'Looking up parallels…'
                : `Look up ${year.trim()} ${setName.trim()} parallels (~${lookUpParallels?.cost})`}
            </button>
            <p className="text-xs text-ink-500">
              {lookUpParallels?.error ?? 'Once per set: after that, every card from it fills in for free.'}
            </p>
          </div>
        )}
      </FormSection>

      <DuplicateNotice matches={matches} />

      <FormSection title="Attributes">
        <div className="flex flex-wrap gap-2" aria-label="Card attributes">
          {FLAGS.map(([name, label]) => (
            <ToggleChip
              key={name}
              label={label}
              pressed={flagValues[name]}
              onToggle={() => setValue(name, !flagValues[name], { shouldDirty: true })}
            />
          ))}
        </div>
        {FLAGS.some(([name]) => fieldNotes[name]) && (
          <p className="mt-2 text-xs text-amber-300">
            AI isn’t sure about:{' '}
            {FLAGS.filter(([name]) => fieldNotes[name])
              .map(([, label]) => label)
              .join(', ')}
            . Check them.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {isGraded ? (
            <>
              <Field label="Grading company" htmlFor="grade_company">
                {textInput('grade_company', { list: 'grade_company', autoCapitalize: 'characters' })}
              </Field>
              <Field label="Grade" htmlFor="grade" hint="e.g. 10, 9.5, Authentic">
                {textInput('grade', { inputMode: 'decimal' })}
              </Field>
              <Field label="Cert #" htmlFor="cert_number">
                {textInput('cert_number', { inputMode: 'numeric' })}
              </Field>
            </>
          ) : (
            <Field label="Condition" htmlFor="raw_condition" hint="Optional, e.g. Near Mint">
              {textInput('raw_condition', { list: 'raw_condition', autoCapitalize: 'words' })}
            </Field>
          )}
          <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
            {textInput('quantity', { inputMode: 'numeric' })}
          </Field>
        </div>
      </FormSection>

      <details open={hasMoney} className={`${panel} group`}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
          <span className={sectionTitle}>Value (optional)</span>
          <Icon name="chevron" size={18} className="text-ink-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-4">
          <Field label="Est. value" htmlFor="estimated_value" error={errors.estimated_value?.message}>
            {textInput('estimated_value', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Paid" htmlFor="purchase_price" error={errors.purchase_price?.message}>
            {textInput('purchase_price', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Purchase date" htmlFor="purchase_date" error={errors.purchase_date?.message}>
            {textInput('purchase_date', { type: 'date' })}
          </Field>
          <div aria-hidden />
          <Field label="Sold for" htmlFor="sold_price" error={errors.sold_price?.message}>
            {textInput('sold_price', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Sold date" htmlFor="sold_date" error={errors.sold_date?.message}>
            {textInput('sold_date', { type: 'date' })}
          </Field>
        </div>
      </details>

      {footer}

      {pending && (
        <DuplicatePrompt
          match={pending.match}
          quantity={Number(pending.values.quantity) || 1}
          busy={saving}
          onMerge={() => void save(pending.values, pending.addAnother, pending.match.card)}
          onSeparate={() => void save(pending.values, pending.addAnother)}
          onCancel={() => setPending(null)}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/[0.05] bg-ink-950/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl gap-3">
          {mode === 'new' ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={submit(false)}
                className={`${buttonSecondary} min-h-12 flex-1`}
              >
                Save
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`${buttonPrimary} min-h-12 flex-[2]`}
              >
                {busy ? 'Saving…' : 'Save & add another'}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className={`${buttonPrimary} min-h-12 flex-1`}
            >
              {busy ? 'Saving…' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

/** Autocomplete lists; a set's checklist can put thousands of players in one, so it renders only when they change. */
const Datalists = memo(function Datalists({ lists, parallels }: { lists: Suggestions; parallels?: string[] }) {
  return (
    <>
      {Object.entries({ ...lists, parallel: parallels }).map(([field, options]) => (
        <datalist key={field} id={`suggest-${field}`}>
          {(options ?? []).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ))}
    </>
  )
})

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${panel} p-4`}>
      <h2 className={`${sectionTitle} mb-3`}>{title}</h2>
      {children}
    </section>
  )
}
