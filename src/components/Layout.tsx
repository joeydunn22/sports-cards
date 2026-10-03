import { NavLink, Outlet, useLocation } from 'react-router'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Collection', icon: 'cards', end: true },
  { to: '/cards/new', label: 'Add', icon: 'plus', end: true },
  { to: '/scan', label: 'Scan', icon: 'camera' },
  { to: '/more', label: 'More', icon: 'more' },
]

/** Full-screen task pages (add/edit a card, capture, review a scan) have their own actions, so they hide the tabs. */
function isTaskPage(pathname: string) {
  return pathname.startsWith('/cards/') || pathname.startsWith('/scan/')
}

export function Layout() {
  const { pathname } = useLocation()
  const showTabs = !isTaskPage(pathname)

  return (
    <div className="min-h-dvh">
      {/* Desktop: top navigation */}
      <header className="sticky top-0 z-20 hidden border-b border-slate-800 bg-slate-950/90 backdrop-blur md:block">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4">
          <NavLink to="/" end className="mr-auto flex min-h-14 items-center gap-2 font-semibold text-slate-100">
            <span className="grid size-8 place-items-center rounded-lg bg-sky-500 text-slate-950">
              <Icon name="cards" size={18} />
            </span>
            Sports Cards
          </NavLink>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm ${
                  isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100'
                }`
              }
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className={showTabs ? 'pb-24 md:pb-0' : ''}>
        <Outlet />
      </div>

      {/* Phone: bottom tab bar */}
      {showTabs && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <div className="grid grid-cols-4">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    isActive ? 'text-sky-400' : 'text-slate-500 active:text-slate-300'
                  }`
                }
              >
                {tab.to === '/cards/new' ? (
                  <span className="grid size-9 place-items-center rounded-full bg-sky-500 text-slate-950">
                    <Icon name="plus" size={22} strokeWidth={2.4} />
                  </span>
                ) : (
                  <Icon name={tab.icon} size={24} />
                )}
                {tab.to !== '/cards/new' && tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
