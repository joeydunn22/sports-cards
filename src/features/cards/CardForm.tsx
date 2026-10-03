import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Field, inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ToggleChip } from '../../components/ToggleChip'
import { buttonPrimary, buttonSecondary, panel, sectionTitle } from '../../components/ui'
import { cardFormSchema, stickyForm, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle, setNameWarning } from './cardText'

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
  onSubmit: (values: CardFormValues, options: { addAnother: boolean }) => Promise<void>
  /** Extra content after the fields, e.g. the delete button on the edit page. */
  footer?: ReactNode
  /** Label for the single button in "edit" mode. */
  submitLabel?: string
}

export function CardForm({
  initialValues,
  suggestions,
  mode,
  onSubmit,
  footer,
  submitLabel = 'Save changes',
}: CardFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CardFormValues>({ resolver: zodResolver(cardFormSchema), defaultValues: initialValues })
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

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
  const flagValues = { is_rookie: isRookie, is_auto: isAuto, is_patch: isPatch, is_relic: isRelic, is_graded: isGraded }
  const hasMoney = Boolean(
    initialValues.purchase_price || initialValues.estimated_value || initialValues.sold_price,
  )

  const submit = (addAnother: boolean) =>
    handleSubmit(async (formValues) => {
      setStatus(null)
      try {
        await onSubmit(formValues, { addAnother })
        if (addAnother) {
          setStatus({ kind: 'ok', text: `Saved: ${cardTitle(toCardInput(formValues))}` })
          reset(stickyForm(formValues))
          window.scrollTo({ top: 0 })
          setFocus('player')
        }
      } catch (err) {
        setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save. Try again.' })
      }
    })

  function textInput(
    name: TextFieldName,
    props: InputHTMLAttributes<HTMLInputElement> & { list?: SuggestionField } = {},
  ) {
    const { list, ...rest } = props
    return (
      <input
        id={name}
        autoComplete="off"
        list={list ? `suggest-${list}` : undefined}
        className={inputClass}
        aria-invalid={errors[name] ? true : undefined}
        {...rest}
        {...register(name)}
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
          <Field label="Player" htmlFor="player" required error={errors.player?.message} className="col-span-2">
            {textInput('player', { list: 'player', autoCapitalize: 'words', autoFocus: mode === 'new' })}
          </Field>
          <Field label="Year" htmlFor="year" required error={errors.year?.message} hint="e.g. 2023 or 2023-24">
            {textInput('year', { list: 'year' })}
          </Field>
          <Field label="Card #" htmlFor="card_number" required error={errors.card_number?.message}>
            {textInput('card_number', { autoCapitalize: 'characters' })}
          </Field>
          <Field
            label="Set"
            htmlFor="set_name"
            required
            error={errors.set_name?.message}
            warning={setNameWarning(setName)}
            hint="The product, no year or color: Topps Finest, Bowman Chrome, Panini Prizm"
            className="col-span-2"
          >
            {textInput('set_name', { list: 'set_name', autoCapitalize: 'words' })}
          </Field>
          <Field label="Sport" htmlFor="sport" required error={errors.sport?.message}>
            {textInput('sport', { list: 'sport', autoCapitalize: 'words' })}
          </Field>
          <Field label="Team" htmlFor="team">
            {textInput('team', { list: 'team', autoCapitalize: 'words' })}
          </Field>
        </div>
      </FormSection>

      <FormSection title="Version">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Insert"
            htmlFor="insert_name"
            hint="Named subset, blank for base: Rookie Autographs, Future Stars"
            className="col-span-2"
          >
            {textInput('insert_name', { list: 'insert_name', autoCapitalize: 'words' })}
          </Field>
          <Field
            label="Parallel"
            htmlFor="parallel"
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
            ) : (
              <p className="text-xs text-slate-500">Leave the first box blank if you only know the print run</p>
            )}
          </div>
        </div>
      </FormSection>

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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          {mode === 'new' ? (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submit(false)}
                className={`${buttonSecondary} min-h-12 flex-1`}
              >
                Save
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${buttonPrimary} min-h-12 flex-[2]`}
              >
                {isSubmitting ? 'Saving…' : 'Save & add another'}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${buttonPrimary} min-h-12 flex-1`}
            >
              {isSubmitting ? 'Saving…' : submitLabel}
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
