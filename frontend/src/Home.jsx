import { useAuth } from './auth'

export default function Home() {
  const { user, handleLogout } = useAuth()

  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user}</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}
