import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, LogoutPage } from './auth'
import LoginPage from './LoginPage'
import Home from './Home'
import Projects from './Projects'
import ServiceReports from './ServiceReports'
import AirConditioningUnits from './AirConditioningUnits'

/** Auth guard — defined outside App so its reference is stable across re-renders */
function Private({ element }) {
  const { user } = useAuth()
  return user ? element : <Navigate to="/login" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/" element={<Private element={<Home />} />} />
      <Route path="/home" element={<Private element={<Home />} />} />
      <Route path="/projects" element={<Private element={<Projects />} />} />
      <Route path="/service-report" element={<Private element={<ServiceReports />} />} />
      <Route path="/service-report/project/:projNum" element={<Private element={<ServiceReports />} />} />
      <Route path="/ac-units/project/:projNum" element={<Private element={<AirConditioningUnits />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
