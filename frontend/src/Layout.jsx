import { useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from './auth'
import logoImg from './assets/logo.png'

export const NAV_ITEMS = [
  { page: 'home',            label: 'Home',             icon: 'icon-[tabler--home]',        path: '/',                 roles: null },
  { page: 'projects',        label: 'Projects',         icon: 'icon-[tabler--folder]',       path: '/projects',         roles: ['ADMIN','STAFF','ACCOUNTING','HR','CREW'] },
  { page: 'service-report',  label: 'Service Report',   icon: 'icon-[tabler--file-report]',  path: '/service-report',   roles: ['ADMIN','STAFF','CREW'] },
  { page: 'schedules',       label: 'Schedules',        icon: 'icon-[tabler--calendar]',     path: '/schedules',        roles: ['ADMIN','STAFF','ACCOUNTING','HR','CREW'] },
  { page: 'inventory',       label: 'Inventory',        icon: 'icon-[tabler--package]',      path: '/inventory',        roles: ['ADMIN','STAFF','ACCOUNTING','CREW'] },
  { page: 'billing',         label: 'Billing',          icon: 'icon-[tabler--receipt]',      path: '/billing',          roles: ['ADMIN','ACCOUNTING'] },
  { page: 'vehicles',        label: 'Vehicles',         icon: 'icon-[tabler--truck]',        path: '/vehicles',         roles: ['ADMIN','STAFF','CREW'] },
  { page: 'employees',       label: 'Employees',        icon: 'icon-[tabler--users]',        path: '/employees',        roles: ['ADMIN','HR'] },
  { page: 'reports',         label: 'Reports',          icon: 'icon-[tabler--chart-bar]',    path: '/reports',          roles: ['ADMIN','STAFF','ACCOUNTING'] },
  { page: 'maintenance',     label: 'Maintenance',      icon: 'icon-[tabler--tool]',         path: '/maintenance',      roles: ['ADMIN'] },
  { page: 'help',            label: 'Help',             icon: 'icon-[tabler--help-circle]',  path: '/help',             roles: ['ADMIN','STAFF','ACCOUNTING','HR','CREW'] },
  { page: 'account-settings',label: 'Account Settings', icon: 'icon-[tabler--settings]',    path: '/account-settings', roles: null },
]

/**
 * Shared page shell with top navbar and role-filtered sidebar.
 * @param {string} activePage - Page key matching one of the NAV_ITEMS entries.
 * @param {React.ReactNode} children - Content rendered inside the main area.
 */
export default function Layout({ activePage, children }) {
  const { fullName, hasRole, handleLogout } = useAuth()
  const { pathname } = useLocation()
  const currentPage = activePage ?? (pathname === '/' || pathname === '/home' ? 'home' : pathname.slice(1))

  // Re-initialize FlyonUI JS components (overlays, modals, etc.) after each navigation
  useEffect(() => {
    window.HSStaticMethods?.autoInit()
  }, [pathname])

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 max-sm:rounded-box max-sm:shadow-sm sm:border-b border-base-content/25 sm:z-1 relative">
        <button type="button" className="btn btn-text max-sm:btn-square sm:hidden me-2" aria-haspopup="dialog" aria-expanded="false" aria-controls="with-navbar-sidebar" data-overlay="#with-navbar-sidebar">
          <span className="icon-[tabler--menu-2] size-5"></span>
        </button>
        <div className="flex flex-1 items-center">
          <a className="link text-base-content link-neutral no-underline" href="#">
            <img src={logoImg} alt="EASI Logo" className="h-10" />
          </a>
        </div>
        <div className="navbar-end flex items-center pe-2">
          <span className="text-sm font-medium text-base-content">{fullName}</span>
        </div>
      </nav>

      <div className="relative flex flex-1">
        <aside id="with-navbar-sidebar" className="overlay [--auto-close:sm] sm:shadow-none overlay-open:translate-x-0 drawer drawer-start hidden max-w-64 sm:absolute sm:z-0 sm:flex sm:translate-x-0 pt-0" role="dialog" tabIndex="-1">
          <div className="drawer-body px-2 pt-4 flex flex-col h-full">
            <ul className="menu p-0 flex-1">
              {NAV_ITEMS.map(({ page, label, icon, path, roles }) => {
                if (roles && !hasRole(...roles)) return null
                return (
                  <>
                    <li key={page}>
                      <Link to={path} className={currentPage === page ? 'menu-active' : ''}>
                        <span className={`${icon} size-5`}></span>
                        {label}
                      </Link>
                    </li>
                    {page === 'account-settings' && (
                      <li key="sign-out">
                        <button className="w-full" onClick={handleLogout}>
                          <span className="icon-[tabler--logout-2] size-5"></span>
                          Sign Out
                        </button>
                      </li>
                    )}
                  </>
                )
              })}
            </ul>
          </div>
        </aside>

        <main className="flex-1 sm:ms-64 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
