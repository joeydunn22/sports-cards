import { NavLink, Outlet } from 'react-router'
import { signOut } from '../hooks/useAuth'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center px-2 text-sm ${isActive ? 'text-sky-400' : 'text-slate-300 hover:text-slate-100'}`

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4">
          <NavLink to="/" end className="mr-auto flex min-h-12 items-center font-semibold text-slate-100">
            Sports Cards
          </NavLink>
          <NavLink to="/" end className={linkClass}>
            Collection
          </NavLink>
          <NavLink to="/import-export" className={linkClass}>
            Import/Export
          </NavLink>
          <button type="button" onClick={() => signOut()} className="min-h-11 px-2 text-sm text-slate-400 hover:text-slate-100">
            Sign out
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
