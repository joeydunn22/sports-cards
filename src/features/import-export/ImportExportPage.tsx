import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards, useImportCards } from '../../hooks/useCards'
import { downloadFile } from '../../lib/csv'
import { cardsToCsv, csvTemplate, parseCardsCsv, type ImportResult } from './cardCsv'

const MAX_ERRORS_SHOWN = 50

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Export/import panels, shown on the More page. */
export function ImportExportSections() {
  const { data } = useCards()
  const cards = data ?? NO_CARDS
  const importCards = useImportCards()
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    importCards.reset()
    if (!file) return
    setFileName(file.name)
    setResult(parseCardsCsv(await file.text()))
    e.target.value = '' // allow re-selecting the same file after fixing it
  }

  const updates = result?.rows.filter((r) => r.id).length ?? 0
  const inserts = (result?.rows.length ?? 0) - updates

  return (
    <>
      <section className={`${panel} flex flex-col gap-3 p-4`}>
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="text-sm text-slate-400">
          Download every card (including sold ones) as a CSV. It opens in Excel or Google Sheets and doubles as a
          backup.
        </p>
        <button
          type="button"
          disabled={cards.length === 0}
          onClick={() => downloadFile(`sports-cards-${today()}.csv`, cardsToCsv(cards))}
          className={`${buttonPrimary} self-start`}
        >
          <Icon name="download" size={18} /> Download CSV ({cards.length} {cards.length === 1 ? 'card' : 'cards'})
        </button>
      </section>

      <section className={`${panel} flex flex-col gap-3 p-4`}>
        <h2 className="text-lg font-semibold">Import</h2>
        <div className="text-sm text-slate-400">
          <p>Add cards in bulk from a spreadsheet saved as CSV.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Required columns: <code>player</code>, <code>year</code>, <code>set_name</code>, <code>card_number</code>,{' '}
              <code>sport</code>. Everything else is optional.
            </li>
            <li>
              Yes/no columns (<code>is_rookie</code>, <code>is_auto</code>…) accept yes/no, y/n, true/false, 1/0 or x.
            </li>
            <li>
              Rows with an <code>id</code> (from an export) update that card; rows without one are added as new cards.
            </li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => downloadFile('sports-cards-template.csv', csvTemplate())}
          className="min-h-11 self-start text-sm text-sky-400 hover:text-sky-300"
        >
          Download blank template
        </button>
        <label className={`${buttonSecondary} cursor-pointer self-start`}>
          <Icon name="upload" size={18} /> Choose CSV file…
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
        </label>

        {result && (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">{fileName}</p>
            {result.fatal ? (
              <p className="text-red-400">{result.fatal}</p>
            ) : (
              <>
                <p>
                  <strong>{result.rows.length}</strong> ready to import
                  {result.rows.length > 0 && ` (${inserts} new, ${updates} updates)`}
                  {result.errors.length > 0 && (
                    <>
                      , <strong className="text-red-400">{result.errors.length}</strong> with problems (these are
                      skipped)
                    </>
                  )}
                </p>
                {result.errors.length > 0 && (
                  <ul className="max-h-64 overflow-y-auto text-sm text-red-300">
                    {result.errors.slice(0, MAX_ERRORS_SHOWN).map((err) => (
                      <li key={err.line}>
                        Row {err.line}: {err.messages.join('; ')}
                      </li>
                    ))}
                    {result.errors.length > MAX_ERRORS_SHOWN && (
                      <li>…and {result.errors.length - MAX_ERRORS_SHOWN} more</li>
                    )}
                  </ul>
                )}
                {importCards.isSuccess ? (
                  <p className="text-emerald-400">
                    Imported: {importCards.data.inserted} added, {importCards.data.updated} updated.{' '}
                    <Link to="/" className="text-sky-400">
                      View collection
                    </Link>
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={result.rows.length === 0 || importCards.isPending}
                    onClick={() => importCards.mutate(result.rows)}
                    className={`${buttonPrimary} self-start`}
                  >
                    {importCards.isPending ? 'Importing…' : `Import ${result.rows.length} cards`}
                  </button>
                )}
                {importCards.isError && <p className="text-red-400">Import failed: {importCards.error.message}</p>}
              </>
            )}
          </div>
        )}
      </section>
    </>
  )
}
