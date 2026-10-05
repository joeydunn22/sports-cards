import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Field, inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ToggleChip } from '../../components/ToggleChip'
import { buttonPrimary, buttonSecondary, panel, sectionTitle } from '../../components/ui'
import type { Card } from '../../types/card'
import { cardFormSchema, stickyForm, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle, setNameWarning } from './cardText'
import { fieldName, fillFromCollection, mergeLookup, type LookupMerge } from './autofill'
import { DuplicateNotice, DuplicatePrompt } from './DuplicateNotice'
import { LookupPanel, type LookupOutcome } from './LookupPanel'
import { findDuplicates, type DuplicateMatch } from './duplicates'

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
  ['is_patch', 'Patch'],
  ['is_relic', 'Relic'],
  ['is_graded', 'Graded'],
] as const

type CardFormProps = {
  initialValues: CardFormValues
  suggestions: Suggestions
  /** "new" shows Save & add another; "edit" shows a single Save changes button. */
  mode: 'new' | 'edit'
  /** `mergeInto` is set when the collector chose to add this copy to an existing card's quantity. */
  onSubmit: (values: CardFormValues, options: { addAnother: boolean; mergeInto?: Card }) => Promise<void>
  /** Extra content after the fields, e.g. the delete button on the edit page. */
  footer?: ReactNode
  /** Label for the single button in "edit" mode. */
  submitLabel?: string
  /** Per-field notes shown as warnings, e.g. fields the AI was unsure about. */
  fieldNotes?: Partial<Record<keyof CardFormValues, string>>
  /** The collection, to flag cards already in it. `askOnSave` offers to merge plain extra copies. */
  duplicates?: { cards: Card[]; excludeId?: string; askOnSave: boolean }
  /** Fill blank fields from matching cards in the collection when Player, Year, Set or Card # is left. */
  autofillFrom?: Card[]
  /** "Look up details": an AI checklist search that fills in blanks (`costLabel` is its estimate). */
  lookUp?: { costLabel: string; run: (values: CardFormValues) => Promise<LookupOutcome> }
}

type PendingSave = { values: CardFormValues; addAnother: boolean; match: DuplicateMatch }

export function CardForm({
  initialValues,
  suggestions,
  mode,
  onSubmit,
  footer,
  submitLabel = 'Save changes',
  fieldNotes = {},
  duplicates,
  autofillFrom,
  lookUp,
}: CardFormProps) {
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
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupResult, setLookupResult] = useState<{ outcome: LookupOutcome; merge: LookupMerge | null } | null>(
    null,
  )

  // Success toasts fade out on their own; errors stay until the next save attempt.
  useEffect(() => {
    if (status?.kind !== 'ok') return
    const timer = window.setTimeout(() => setStatus(null), 4000)
    return () => window.clearTimeout(timer)
  }, [status])

  const [setName, isRookie, isAuto, isPatch, isRelic, isGraded] = useWatch({
    control,
    name: ['set_name', 'is_rookie', 'is_auto', 'is_patch', 'is_relic', 'is_graded'],
  })
  const [player, year, insertName, parallel, cardNumber, serial, cert] = useWatch({
    control,
    name: ['player', 'year', 'insert_name', 'parallel', 'card_number', 'serial_number', 'cert_number'],
  })
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
  const flagValues = { is_rookie: isRookie, is_auto: isAuto, is_patch: isPatch, is_relic: isRelic, is_graded: isGraded }
  const hasMoney = Boolean(
    initialValues.purchase_price || initialValues.estimated_value || initialValues.sold_price,
  )

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
        setLookupResult(null)
        window.scrollTo({ top: 0 })
        setFocus('player')
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
    for (const [field, value] of Object.entries(values)) {
      setValue(field as keyof CardFormValues, value as never, { shouldDirty: true })
    }
  }

  // Free: fill blanks from the collection when an identifying field is left.
  function autofill() {
    if (!autofillFrom) return
    const fill = fillFromCollection(getValues(), autofillFrom)
    if (!fill) return
    apply(fill.values)
    setFilledNote(`Filled ${fill.fields.map(fieldName).join(', ')} from ${fill.source}.`)
  }

  async function runLookUp() {
    if (!lookUp) return
    setLookupBusy(true)
    try {
      const outcome = await lookUp.run(getValues())
      if (!outcome) return // cancelled at the cost prompt
      const merge = outcome.found ? mergeLookup(getValues(), outcome.found) : null
      if (merge) apply(merge.values)
      setLookupResult({ outcome, merge })
    } catch (err) {
      setLookupResult({ outcome: { error: err instanceof Error ? err.message : 'The lookup failed.' }, merge: null })
    } finally {
      setLookupBusy(false)
    }
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
    <form
      onSubmit={submit(mode === 'new')}
      noValidate
      className="flex flex-col gap-4 pb-28"
    >
      {Object.entries(suggestions).map(([field, options]) => (
        <datalist key={field} id={`suggest-${field}`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ))}

      {status && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <p
            role="status"
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl shadow-black/40 ${
              status.kind === 'ok' ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'
            }`}
          >
            {status.kind === 'ok' && <Icon name="check" size={18} className="mt-px shrink-0" />}
            {status.text}
          </p>
        </div>
      )}

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
              autoCapitalize: 'words',
              autoFocus: mode === 'new',
              onBlur: autofill,
            })}
          </Field>
          <Field
            label="Year"
            htmlFor="year"
            required
            error={errors.year?.message}
            warning={fieldNotes.year}
            hint="e.g. 2023 or 2023-24"
          >
            {textInput('year', { list: 'year', onBlur: autofill })}
          </Field>
          <Field
            label="Card #"
            htmlFor="card_number"
            required
            error={errors.card_number?.message}
            warning={fieldNotes.card_number}
          >
            {textInput('card_number', { autoCapitalize: 'characters', onBlur: autofill })}
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
            {textInput('set_name', { list: 'set_name', autoCapitalize: 'words', onBlur: autofill })}
          </Field>
          <Field label="Sport" htmlFor="sport" required error={errors.sport?.message} warning={fieldNotes.sport}>
            {textInput('sport', { list: 'sport', autoCapitalize: 'words' })}
          </Field>
          <Field label="Team" htmlFor="team" warning={fieldNotes.team}>
            {textInput('team', { list: 'team', autoCapitalize: 'words' })}
          </Field>
        </div>
        {filledNote && <p className="mt-3 text-xs text-emerald-300">{filledNote}</p>}
        {lookUp && (
          <LookupPanel
            costLabel={lookUp.costLabel}
            canRun={Boolean(player.trim() && (setName.trim() || cardNumber.trim()))}
            busy={lookupBusy}
            result={lookupResult}
            onRun={() => void runLookUp()}
            onUse={(field, value) => {
              apply({ [field]: value })
              setLookupResult((r) =>
                r?.merge ? { ...r, merge: { ...r.merge, conflicts: r.merge.conflicts.filter((c) => c.field !== field) } } : r,
              )
            }}
          />
        )}
      </FormSection>

      <FormSection title="Version">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Insert"
            htmlFor="insert_name"
            warning={fieldNotes.insert_name}
            hint="Named subset, blank for base: Rookie Autographs, Future Stars"
            className="col-span-2"
          >
            {textInput('insert_name', { list: 'insert_name', autoCapitalize: 'words' })}
          </Field>
          <Field
            label="Parallel"
            htmlFor="parallel"
            warning={fieldNotes.parallel}
            hint="Color or finish, blank for base: Refractor, Red Refractor, Silver"
            className="col-span-2"
          >
            {textInput('parallel', { list: 'parallel', autoCapitalize: 'words' })}
          </Field>
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Serial numbered</span>
            <div className="flex items-center gap-2">
              <input
                id="serial_number"
                aria-label="Serial number"
                inputMode="numeric"
                placeholder="23"
                className={inputClass}
                {...register('serial_number')}
              />
              <span className="text-lg text-slate-500">/</span>
              <input
                id="print_run"
                aria-label="Print run"
                inputMode="numeric"
                placeholder="99"
                className={inputClass}
                {...register('print_run')}
              />
            </div>
            {errors.serial_number || errors.print_run ? (
              <p className="text-xs text-red-400">{errors.serial_number?.message ?? errors.print_run?.message}</p>
            ) : fieldNotes.serial_number || fieldNotes.print_run ? (
              <p className="text-xs text-amber-300">{fieldNotes.serial_number ?? fieldNotes.print_run}</p>
            ) : (
              <p className="text-xs text-slate-500">Leave the first box blank if you only know the print run</p>
            )}
          </div>
        </div>
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
          <Icon name="back" size={18} className="-rotate-90 text-slate-500 transition-transform group-open:rotate-90" />
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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${panel} p-4`}>
      <h2 className={`${sectionTitle} mb-3`}>{title}</h2>
      {children}
    </section>
  )
}
