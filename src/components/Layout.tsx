import { NavLink, Outlet, useLocation } from 'react-router'
import { Icon, type IconName } from './Icon'

/** Scan and Add sit side by side: they're the two ways cards get in. */
const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Collection', icon: 'cards', end: true },
  { to: '/scan', label: 'Scan', icon: 'camera' },
  { to: '/cards/new', label: 'Add', icon: 'plus', end: true },
  { to: '/more', label: 'More', icon: 'more' },
]

/** Full-screen task pages (add/edit a card, capture, review a scan, touch up photos) have their own actions, so they hide the tabs. */
function isTaskPage(pathname: string) {
  return pathname.startsWith('/cards/') || pathname.startsWith('/scan/') || pathname.startsWith('/photos/')
}

export function Layout() {
  const { pathname } = useLocation()
  const showTabs = !isTaskPage(pathname)

  return (
    <div className="min-h-dvh">
      {/* Desktop: top navigation */}
      <header className="sticky top-0 z-20 hidden border-b border-white/[0.05] bg-ink-950/80 backdrop-blur-xl md:block">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4">
          <NavLink to="/" end className="mr-auto flex min-h-14 items-center gap-2.5 font-semibold tracking-tight text-ink-50">
            <span className="grid size-7 place-items-center rounded-lg bg-accent-400 text-ink-950">
              <Icon name="cards" size={16} strokeWidth={2.2} />
            </span>
            Sports Cards
          </NavLink>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100'
                }`
              }
            >
              <Icon name={tab.icon} size={17} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* key: each page fades in when the route changes */}
      <div key={pathname} className={`animate-page-in ${showTabs ? 'pb-32 md:pb-0' : ''}`}>
        <Outlet />
      </div>

      {/* Phone: a floating tab bar */}
      {showTabs && (
        <nav
          aria-label="Main"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-4 rounded-[28px] bg-ink-900/85 p-1.5 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.07] backdrop-blur-xl">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  `relative flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-medium tracking-wide transition-colors ${
                    isActive ? 'text-accent-400' : 'text-ink-500 active:text-ink-300'
                  }`
                }
              >
                {({ isActive }) =>
                  tab.to === '/cards/new' ? (
                    <span className="grid size-10 place-items-center rounded-full bg-accent-400 text-ink-950 shadow-[0_0_24px_-4px] shadow-accent-400/50 active:scale-95">
                      <Icon name="plus" size={22} strokeWidth={2.4} />
                    </span>
                  ) : (
                    <>
                      <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                      {tab.label}
                    </>
                  )
                }
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
