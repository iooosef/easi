import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'

/** Navigation items shown as icon cards on the Home page. Independent from the sidebar. */
const HOME_NAV_ITEMS = [
  { page: 'new-schedule', label: 'Make new Schedule', icon: 'icon-[tabler--calendar-plus]', path: '/schedules/new', roles: ['ADMIN', 'STAFF'] },
]

export default function Home() {
  const { fullName, hasRole } = useAuth()

  const navCards = HOME_NAV_ITEMS.filter(
    ({ roles }) => roles === null || hasRole(...roles)
  )

  return (
    <Layout activePage="home">
      <h1 className="text-3xl font-semibold mb-1">Welcome, {fullName}</h1>
      <p className="text-base-content/60 mb-8">What would you like to do today?</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {navCards.map(({ page, label, icon, path }) => (
          <Link key={page} to={path} className="group">
            <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
              <div className="card-body items-center justify-center text-center gap-3 py-8">
                <span className={`${icon} size-10 text-primary`}></span>
                <p className="font-medium text-base-content">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
