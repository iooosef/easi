import { useState } from 'react'
import Layout from './Layout'
import { useAuth } from './auth'

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

/** Module guide entries — one per major sidebar section. */
const MODULES = [
  {
    icon: 'icon-[tabler--home]',
    title: 'Home',
    description:
      'The Home page provides quick-action shortcuts for the most common tasks so you can get to work without navigating the sidebar.',
    actions: [
      'Create a new schedule',
      'Start a new service report',
      'Raise a new purchase order',
      'Record a client payment',
      'Add a vehicle trip log',
      'Log refueling for a vehicle',
    ],
    roles: 'All roles (shortcuts shown depend on your role)',
  },
  {
    icon: 'icon-[tabler--folder]',
    title: 'Projects',
    description:
      'Projects are the core unit of work. Each project represents a client engagement and groups all related service reports, schedules, AC units, and documents.',
    actions: [
      'View all projects and their current status',
      'Add or edit a project record',
      'Browse documents attached to a project',
      'Navigate to a project\'s service reports or schedules',
    ],
    roles: 'ADMIN, STAFF, ACCOUNTING, HR, CREW',
    hideFor: ['HR'],
  },
  {
    icon: 'icon-[tabler--file-report]',
    title: 'Service Reports',
    description:
      'Service reports document the work performed on a project. Each report can contain findings, purchase orders for parts, and attached documents.',
    actions: [
      'Create a new service report from Home or the Service Reports page',
      'Add findings (observations, recommendations, and actions taken)',
      'Attach purchase orders for parts used during the service',
      'Upload supporting documents (photos, PDFs)',
    ],
    roles: 'ADMIN, STAFF, CREW',
    hideFor: ['HR'],
  },
  {
    icon: 'icon-[tabler--calendar]',
    title: 'Schedules',
    description:
      'Schedules track planned service visits for projects. Each schedule can include assigned employees, equipment, and vehicles.',
    actions: [
      'Create a new schedule from Home or the Schedules page',
      'Assign employees, vehicles, and equipment to a schedule',
      'Filter schedules by project',
      'Edit or cancel existing schedules',
    ],
    roles: 'ADMIN, STAFF, ACCOUNTING, HR, CREW',
  },
  {
    icon: 'icon-[tabler--package]',
    title: 'Inventory',
    description:
      'Inventory manages the company\'s parts, equipment, and suppliers. Purchase orders can be raised for parts or equipment procurement and tracked through to delivery.',
    actions: [
      'View and manage parts stock levels',
      'Add and manage equipment records',
      'Manage supplier information',
      'Raise and track purchase orders for parts and equipment',
      'Attach delivery documents to purchase orders',
    ],
    roles: 'ADMIN, STAFF, ACCOUNTING, CREW',
    hideFor: ['HR', 'CREW'],
  },
  {
    icon: 'icon-[tabler--truck]',
    title: 'Vehicles & Logs',
    description:
      'Vehicles tracks the company fleet. Vehicle logs record individual trips, and gas logs record refueling events associated with each trip.',
    actions: [
      'View all vehicles in the fleet',
      'Add a vehicle log for a completed trip',
      'Log refueling from Home using the "Log Refueling" shortcut',
      'View gas consumption history per vehicle',
    ],
    roles: 'ADMIN, STAFF, CREW',
    hideFor: ['HR'],
  },
  {
    icon: 'icon-[tabler--receipt]',
    title: 'Billing',
    description:
      'Billing tracks payments owed by clients based on completed service reports. Payments can be recorded and the billing status updates automatically.',
    actions: [
      'View all billing records with their payment status (Unpaid, Partial, Paid)',
      'Record a payment against a billing entry',
      'Filter records by payment status',
    ],
    roles: 'ADMIN, ACCOUNTING',
    hideFor: ['HR', 'CREW', 'STAFF'],
  },
  {
    icon: 'icon-[tabler--users]',
    title: 'Employees',
    description:
      'Employees manages the personnel roster. Employees can be assigned to schedules and service reports.',
    actions: [
      'View all employee records',
      'Add or edit an employee',
      'Deactivate employees who are no longer with the company',
    ],
    roles: 'ADMIN, HR',
    hideFor: ['ACCOUNTING', 'STAFF'],
  },
  {
    icon: 'icon-[tabler--chart-bar]',
    title: 'Reports',
    description:
      'Reports generate printable summaries of system data over a selected date range. Any report can be saved as a PDF using the browser print dialog.',
    actions: [
      'Select a report type from the left panel',
      'Choose a date range using a preset (Last 7 Days, Last 30 Days, etc.) or a custom range',
      'View the generated table once data loads',
      'Click "Print / Save as PDF" to print or export',
    ],
    roles: 'ADMIN, STAFF, ACCOUNTING',
    hideFor: ['HR', 'CREW'],
  },
  {
    icon: 'icon-[tabler--tool]',
    title: 'Maintenance',
    description:
      'Maintenance provides administrative tools for system configuration and user account management. Access is restricted to system administrators.',
    actions: [
      'Create and manage user accounts',
      'Assign roles to users',
      'View the audit log of all system changes',
    ],
    roles: 'ADMIN only',
    hideFor: ['ACCOUNTING', 'HR', 'CREW', 'STAFF'],
  },
]

/** Frequently asked questions. */
const FAQS = [
  {
    q: 'How do I generate a report?',
    a: 'Go to Reports from the sidebar. Select a report type from the left panel, then choose a date range using one of the preset buttons or enter a custom range. The table will load automatically. Click "Print / Save as PDF" to export.',
  },
  {
    q: 'How do I log refueling for a vehicle?',
    a: 'From the Home page, click "Log Refueling". Select the vehicle, then select the corresponding trip log. Enter the invoice ID and fuel amount, and optionally attach a receipt photo.',
  },
  {
    q: 'How do I attach a document to a service report?',
    a: 'Open the service report from the Service Reports page, then click the Documents button. You can upload PDF or image files from the document panel.',
  },
  {
    q: "Why can't I see some pages or actions?",
    a: 'Access to certain pages and actions depends on your assigned role. For example, Billing is only visible to ADMIN and ACCOUNTING, and Maintenance is only accessible to ADMIN. Contact your system administrator if you need access to a feature.',
  },
  {
    q: 'How do I create a purchase order for parts?',
    a: 'You can create a purchase order from three places: the Home page shortcut "New Purchase Order", the Inventory > Purchase Orders page, or directly inside a service report under its Purchase Orders section.',
  },
  {
    q: 'How do I assign employees to a schedule?',
    a: 'When creating or editing a schedule, use the employee assignment section to search for and add employees. Make sure employees have been added under the Employees page first.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Contact your HR or administrator for password reset.',
  },
]

/** Developer / team contact details. */
const CONTACTS = [
  {
    name: 'Joseph Clarence C. Parayaoan',
    role: 'Full-Stack Developer',
    email: 'josence22+easi@gmail.com',
  },
  {
    name: 'John Michael Dublin Palaganas',
    role: 'Developer',
    email: 'Jmdublinpalaganas@gmail.com',
  },
  {
    name: 'Tristian James Moreno Cabalar',
    role: 'Developer',
    email: 'tristianjamesm.c.01@gmail.com',
  },
]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Collapsible accordion item using the native <details> element.
 * No JavaScript plugin required — state is managed by the browser.
 */
function AccordionItem({ icon, title, children }) {
  return (
    <details className="border border-base-300 rounded-xl overflow-hidden group">
      <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none bg-base-100 hover:bg-base-200 transition-colors [list-style:none] [&::-webkit-details-marker]:hidden">
        <span className={`${icon} size-5 text-primary shrink-0`} />
        <span className="font-medium flex-1">{title}</span>
        <span className="icon-[tabler--chevron-down] size-4 text-base-content/50 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-5 py-4 border-t border-base-300 text-sm text-base-content/80 space-y-3">
        {children}
      </div>
    </details>
  )
}

/** Module-by-module user guide. */
function HelpTab() {
  const { role } = useAuth()
  const visibleModules = MODULES.filter(m => !m.hideFor?.includes(role))

  return (
    <div className="space-y-4">
      {/* Getting started banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl px-5 py-4">
        <h2 className="font-semibold text-base-content mb-1 flex items-center gap-2">
          <span className="icon-[tabler--info-circle] size-5 text-primary" />
          Getting Started
        </h2>
        <p className="text-sm text-base-content/70">
          EASI is a field service management system. Use the sidebar to navigate between modules.
          The <strong>Home</strong> page provides quick-action shortcuts for the most common tasks.
          Your role determines which pages and actions are available to you.
        </p>
      </div>

      {/* Per-module accordions */}
      <div className="space-y-2">
        {visibleModules.map(({ icon, title, description, actions }) => (
          <AccordionItem key={title} icon={icon} title={title}>
            <p>{description}</p>
            <ul className="list-disc list-inside space-y-1">
              {actions.map(a => <li key={a}>{a}</li>)}
            </ul>
          </AccordionItem>
        ))}
      </div>
    </div>
  )
}

/** Frequently asked questions as accordions. */
function FaqTab() {
  return (
    <div className="space-y-2">
      {FAQS.map(({ q, a }) => (
        <AccordionItem key={q} icon="icon-[tabler--help-circle]" title={q}>
          <p>{a}</p>
        </AccordionItem>
      ))}
    </div>
  )
}

/** Static developer contact cards. */
function ContactTab() {
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-base-content/60">
        For technical issues, feature requests, or bug reports, reach out to the development team below.
      </p>
      {CONTACTS.map(({ name, role, email }) => (
        <div key={name} className="card border border-base-300 bg-base-100">
          <div className="card-body gap-3 py-5">
            <div className="flex items-center gap-3">
              <span className="icon-[tabler--user-circle] size-10 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-base-content/50">{role}</p>
              </div>
            </div>
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 text-sm link link-hover text-base-content/70"
            >
              <span className="icon-[tabler--mail] size-4 shrink-0" />
              {email}
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'help',    label: 'Help',              icon: 'icon-[tabler--book]' },
  { key: 'faq',     label: 'FAQs',              icon: 'icon-[tabler--help-circle]' },
  { key: 'contact', label: 'Developer Contact', icon: 'icon-[tabler--address-book]' },
]

/** Help page with module guide, FAQs, and developer contact tabs. */
export default function Help() {
  const [tab, setTab] = useState('help')

  return (
    <Layout activePage="help">
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Help Center</h1>
        <p className="text-base-content/50 text-sm mb-6">
          Documentation, FAQs, and developer contact information.
        </p>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-base-300 mb-6">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/60 hover:text-base-content'
              }`}
            >
              <span className={`${icon} size-4`} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'help'    && <HelpTab />}
        {tab === 'faq'     && <FaqTab />}
        {tab === 'contact' && <ContactTab />}
      </div>
    </Layout>
  )
}
