import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, LogoutPage } from './auth'
import LoginPage from './LoginPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetOtpPage from './ResetOtpPage'
import ResetPasswordPage from './ResetPasswordPage'
import Home from './Home'
import Projects from './Projects'
import ServiceReports from './ServiceReports'
import ServiceReportFindings from './ServiceReportFindings'
import AirConditioningUnits from './AirConditioningUnits'
import AccountSettings from './AccountSettings'
import Employees from './Employees'
import Schedules from './Schedules'
import Vehicles from './Vehicles'
import VehicleLogs from './VehicleLogs'
import MaintenancePage from './MaintenancePage'
import PurchaseOrders from './PurchaseOrders'
import Documents from './Documents'
import Inventory from './Inventory'
import Billing from './Billing'

/** Auth guard — defined outside App so its reference is stable across re-renders */
function Private({ element }) {
  const { user } = useAuth()
  return user ? element : <Navigate to="/login" replace />
}

/** Auth + role guard — redirects to home if the user lacks the required role */
function PrivateRole({ element, role }) {
  const { user, hasRole } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!hasRole(role)) return <Navigate to="/" replace />
  return element
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-otp" element={<ResetOtpPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<Private element={<Home />} />} />
      <Route path="/home" element={<Private element={<Home />} />} />
      <Route path="/projects" element={<Private element={<Projects />} />} />
      <Route path="/service-report" element={<Private element={<ServiceReports />} />} />
      <Route path="/service-report/project/:projNum" element={<Private element={<ServiceReports />} />} />
      <Route path="/ac-units/project/:projNum" element={<Private element={<AirConditioningUnits />} />} />
      <Route path="/service-report/:srNumber/findings" element={<Private element={<ServiceReportFindings />} />} />
      <Route path="/service-report/:srNumber/purchase-orders" element={<Private element={<PurchaseOrders />} />} />
      <Route path="/service-report/:srNumber/documents" element={<Private element={<Documents />} />} />
      <Route path="/schedules" element={<Private element={<Schedules />} />} />
      <Route path="/schedules/project/:projNum" element={<Private element={<Schedules />} />} />
      <Route path="/inventory" element={<Private element={<Inventory />} />} />
      <Route path="/billing" element={<Private element={<Billing />} />} />
      <Route path="/vehicles" element={<Private element={<Vehicles />} />} />
      <Route path="/vehicles/:vehiclesId/logs" element={<Private element={<VehicleLogs />} />} />
      <Route path="/employees" element={<Private element={<Employees />} />} />
      <Route path="/maintenance" element={<PrivateRole element={<MaintenancePage />} role="ADMIN" />} />
      <Route path="/account-settings" element={<Private element={<AccountSettings />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
