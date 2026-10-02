import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type InputHTMLAttributes } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Field, inputClass } from '../../components/Field'
import { ToggleChip } from '../../components/ToggleChip'
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
}

export function CardForm({ initialValues, suggestions, mode, onSubmit }: CardFormProps) {
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
      className="flex flex-col gap-6 pb-28"
    >
      {Object.entries(suggestions).map(([field, options]) => (
        <datalist key={field} id={`suggest-${field}`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ))}

      {status && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === 'ok' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
          }`}
        >
          {status.text}
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
      </section>

      <section className="flex flex-wrap gap-2" aria-label="Card attributes">
        {FLAGS.map(([name, label]) => (
          <ToggleChip
            key={name}
            label={label}
            pressed={flagValues[name]}
            onToggle={() => setValue(name, !flagValues[name], { shouldDirty: true })}
          />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-slate-300">Serial numbered</span>
          <div className="flex items-center gap-2">
            <input
              id="serial_number"
              aria-label="Serial number"
              inputMode="numeric"
              placeholder="23"
              className={inputClass}
              {...register('serial_number')}
            />
            <span className="text-slate-500">/</span>
            <input
              id="print_run"
              aria-label="Print run"
              inputMode="numeric"
              placeholder="99"
              className={inputClass}
              {...register('print_run')}
            />
          </div>
          {(errors.serial_number || errors.print_run) && (
            <p className="text-xs text-red-400">{errors.serial_number?.message ?? errors.print_run?.message}</p>
          )}
        </div>
        <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
          {textInput('quantity', { inputMode: 'numeric' })}
        </Field>
      </section>

      {isGraded ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Grading company" htmlFor="grade_company">
            {textInput('grade_company', { list: 'grade_company', autoCapitalize: 'characters' })}
          </Field>
          <Field label="Grade" htmlFor="grade" hint="e.g. 10, 9.5, Authentic">
            {textInput('grade', { inputMode: 'decimal' })}
          </Field>
          <Field label="Cert #" htmlFor="cert_number" className="col-span-2">
            {textInput('cert_number', { inputMode: 'numeric' })}
          </Field>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Condition" htmlFor="raw_condition" hint="Optional, e.g. Near Mint">
            {textInput('raw_condition', { list: 'raw_condition', autoCapitalize: 'words' })}
          </Field>
        </section>
      )}

      <details open={hasMoney} className="rounded-lg border border-slate-800 p-4">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-300">
          Value (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Est. value" htmlFor="estimated_value" error={errors.estimated_value?.message}>
            {textInput('estimated_value', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Paid" htmlFor="purchase_price" error={errors.purchase_price?.message}>
            {textInput('purchase_price', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Purchase date" htmlFor="purchase_date" error={errors.purchase_date?.message}>
            {textInput('purchase_date', { type: 'date' })}
          </Field>
          <div className="hidden sm:block" />
          <Field label="Sold for" htmlFor="sold_price" error={errors.sold_price?.message}>
            {textInput('sold_price', { inputMode: 'decimal', placeholder: '0.00' })}
          </Field>
          <Field label="Sold date" htmlFor="sold_date" error={errors.sold_date?.message}>
            {textInput('sold_date', { type: 'date' })}
          </Field>
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          {mode === 'new' ? (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submit(false)}
                className="min-h-12 flex-1 rounded-lg border border-slate-700 font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-12 flex-[2] rounded-lg bg-sky-500 font-semibold text-slate-950 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save & add another'}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 flex-1 rounded-lg bg-sky-500 font-semibold text-slate-950 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
