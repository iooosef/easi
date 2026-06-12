import { Link } from 'react-router-dom'
import Layout from './Layout'

const INVENTORY_NAV_ITEMS = [
  {
    key: 'purchase-orders',
    label: 'Purchase Orders',
    icon: 'icon-[tabler--file-invoice]',
    path: '/inventory/purchase-orders',
    description: 'Manage POs and their parts',
  },
  {
    key: 'parts',
    label: 'Parts',
    icon: 'icon-[tabler--package]',
    path: '/inventory/parts',
    description: 'View and manage all parts',
  },
  {
    key: 'equipment',
    label: 'Equipment',
    icon: 'icon-[tabler--tool]',
    path: '/inventory/equipment',
    description: 'Track durable and consumable equipment',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    icon: 'icon-[tabler--building-store]',
    path: '/inventory/suppliers',
    description: 'Manage supplier records',
  },
]

export default function Inventory() {
  return (
    <Layout activePage="inventory">
      <h1 className="text-3xl font-semibold mb-1">Inventory</h1>
      <p className="text-base-content/60 mb-8">Select a category to manage</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {INVENTORY_NAV_ITEMS.map(({ key, label, icon, path, description }) => (
          <Link key={key} to={path} className="group">
            <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
              <div className="card-body items-center justify-center text-center gap-3 py-8">
                <span className={`${icon} size-10 text-primary`}></span>
                <div>
                  <p className="font-medium text-base-content">{label}</p>
                  <p className="text-xs text-base-content/50 mt-1">{description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
