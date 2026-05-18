import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, LogoutPage } from './auth'
import LoginPage from './LoginPage'
import Home from './Home'

function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/logout" element={<LogoutPage />} />
      <Route
        path="/*"
        element={user ? <Home /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
