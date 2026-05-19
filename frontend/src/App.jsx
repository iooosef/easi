import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, LogoutPage } from './auth'
import LoginPage from './LoginPage'
import Home from './Home'
import Projects from './Projects'
import ServiceReports from './ServiceReports'

function App() {
  const { user } = useAuth()

  /** Wraps a page element with an auth guard */
  function Private({ element }) {
    return user ? element : <Navigate to="/login" replace />
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/" element={<Private element={<Home />} />} />
      <Route path="/home" element={<Private element={<Home />} />} />
      <Route path="/projects" element={<Private element={<Projects />} />} />
      <Route path="/service-report" element={<Private element={<ServiceReports />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
