import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, LogoutPage } from './auth'
import LoginPage from './pages/LoginPage'
import Home from './pages/Home'
import Projects from './pages/Projects'
import ServiceReports from './pages/ServiceReports'
import ServiceReportFindings from './pages/ServiceReportFindings'
import AirConditioningUnits from './pages/AirConditioningUnits'
import Employees from './pages/Employees'
import Schedules from './pages/Schedules'
import NewSchedule from './pages/NewSchedule'
import NewServiceReport from './pages/NewServiceReport'
import Vehicles from './pages/Vehicles'
import VehicleLogs from './pages/VehicleLogs'
import MaintenancePage from './pages/MaintenancePage'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseOrderDocuments from './pages/PurchaseOrderDocuments'
import InventoryPurchaseOrders from './pages/InventoryPurchaseOrders'
import Documents from './pages/Documents'
import ProjectDocuments from './pages/ProjectDocuments'
import Inventory from './pages/Inventory'
import InventoryParts from './pages/InventoryParts'
import InventorySuppliers from './pages/InventorySuppliers'
import InventoryEquipment from './pages/InventoryEquipment'
import NewEquipmentPO from './pages/NewEquipmentPO'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import Help from './pages/Help'

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
      <Route path="/" element={<Private element={<Home />} />} />
      <Route path="/home" element={<Private element={<Home />} />} />
      <Route path="/projects" element={<Private element={<Projects />} />} />
      <Route path="/service-report" element={<Private element={<ServiceReports />} />} />
      <Route path="/service-report/new" element={<Private element={<NewServiceReport />} />} />
      <Route path="/service-report/project/:projNum" element={<Private element={<ServiceReports />} />} />
      <Route path="/ac-units/project/:projNum" element={<Private element={<AirConditioningUnits />} />} />
      <Route path="/projects/:projNum/documents" element={<Private element={<ProjectDocuments />} />} />
      <Route path="/service-report/:srNumber/findings" element={<Private element={<ServiceReportFindings />} />} />
      <Route path="/service-report/:srNumber/purchase-orders" element={<Private element={<PurchaseOrders />} />} />
      <Route path="/service-report/:srNumber/purchase-orders/:poNum/documents" element={<Private element={<PurchaseOrderDocuments />} />} />
      <Route path="/service-report/:srNumber/documents" element={<Private element={<Documents />} />} />
      <Route path="/schedules" element={<Private element={<Schedules />} />} />
      <Route path="/schedules/new" element={<Private element={<NewSchedule />} />} />
      <Route path="/schedules/project/:projNum" element={<Private element={<Schedules />} />} />
      <Route path="/inventory" element={<Private element={<Inventory />} />} />
      <Route path="/inventory/purchase-orders" element={<Private element={<InventoryPurchaseOrders />} />} />
      <Route path="/inventory/purchase-orders/:poNum/documents" element={<Private element={<PurchaseOrderDocuments />} />} />
      <Route path="/inventory/parts" element={<Private element={<InventoryParts />} />} />
      <Route path="/inventory/suppliers" element={<Private element={<InventorySuppliers />} />} />
      <Route path="/inventory/equipment" element={<Private element={<InventoryEquipment />} />} />
      <Route path="/inventory/equipment/new" element={<Private element={<NewEquipmentPO />} />} />
      <Route path="/billing" element={<Private element={<Billing />} />} />
      <Route path="/reports" element={<Private element={<Reports />} />} />
      <Route path="/vehicles" element={<Private element={<Vehicles />} />} />
      <Route path="/vehicles/:vehiclesId/logs" element={<Private element={<VehicleLogs />} />} />
      <Route path="/employees" element={<Private element={<Employees />} />} />
      <Route path="/help" element={<Private element={<Help />} />} />
      <Route path="/maintenance" element={<PrivateRole element={<MaintenancePage />} role="ADMIN" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
