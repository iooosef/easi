import { useAuth } from './auth'

export default function Home() {
  const { user, handleLogout } = useAuth()

  return (
    <div className="min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 shadow-sm px-6">
        <div className="flex-1">
          <span className="text-xl font-bold">EASI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-base-content/70">{user}</span>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <main className="p-8">
        <h1 className="text-3xl font-semibold">Welcome, {user}</h1>
      </main>
    </div>
  )
}
