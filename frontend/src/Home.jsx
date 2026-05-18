import { useAuth } from './auth'
import Layout from './Layout'

export default function Home() {
  const { fullName } = useAuth()

  return (
    <Layout activePage="home">
      <h1 className="text-3xl font-semibold">Welcome, {fullName}</h1>
    </Layout>
  )
}
