import { updateApp, useAppVersion } from '../hooks/useAppVersion'
import { formatBuild } from '../lib/format'
import { Icon } from './Icon'

/** Which build is running; turns into an Update button when a newer deploy is live. */
export function VersionTag() {
  const { current, latest, outdated } = useAppVersion()

  if (outdated && latest) {
    return (
      <button
        type="button"
        onClick={updateApp}
        title={`Running ${formatBuild(current)}; ${formatBuild(latest)} is live`}
        className="flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-medium text-accent-400 active:text-accent-300"
      >
        <Icon name="refresh" size={14} /> Update
      </button>
    )
  }
  return (
    <span className="text-xs text-ink-500 tabular-nums" title={`Built ${new Date(current.time).toLocaleString()}`}>
      {formatBuild(current)}
    </span>
  )
}
