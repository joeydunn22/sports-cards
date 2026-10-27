import { Icon } from '../../components/Icon'
import { listGroup } from '../../components/ui'
import { CardThumb } from './CardThumb'
import type { CardGroup, GroupBy } from './collection'
import { teamColors } from './teamColors'

type GroupListProps = { groups: CardGroup[]; by: GroupBy; onPick: (group: CardGroup) => void }

/** The collection by set, player or team: one row per group with a cover photo and a count. Tap to see its cards. */
export function GroupList({ groups, by, onPick }: GroupListProps) {
  return (
    <ul className={listGroup}>
      {groups.map((group) => {
        const colors = by === 'team' ? teamColors(group.label, group.cover) : null
        return (
          <li key={group.key} className="relative">
            {colors && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full"
                style={{ backgroundColor: colors.onDark }}
              />
            )}
            <button
              type="button"
              onClick={() => onPick(group)}
              className="flex min-h-16 w-full items-center gap-3.5 py-2.5 pr-4 pl-4 text-left active:bg-ink-800"
            >
              {group.cover.front_image_path && <CardThumb path={group.cover.front_image_path} className="w-10" />}
              <span className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-tight text-ink-50">
                {group.label}
              </span>
              <span className="text-[13px] text-ink-400 tabular-nums">{group.count.toLocaleString()}</span>
              <Icon name="back" size={16} className="rotate-180 text-ink-600" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
