import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import NewScheduleForm from '../components/NewScheduleForm'

/** Page wrapper for creating a new schedule — renders the form with a side calendar. */
export default function NewSchedule() {
  const navigate = useNavigate()

  return (
    <Layout activePage="new-schedule">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Make New Schedule</h1>
        <p className="text-base-content/60 mt-1">Create a new service schedule for a project.</p>
      </div>
      <NewScheduleForm showCalendar onDone={() => navigate('/schedules')} />
    </Layout>
  )
}
