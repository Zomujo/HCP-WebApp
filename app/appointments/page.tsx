import { appointments } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function AppointmentsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="app-header">
          <div>
            <h1 className="page-title">Appointments</h1>
            <p className="subtitle">Set and review appointments for your patients.</p>
          </div>
          <button className="primary small">+ Set Appointment</button>
        </div>

        <div className="panel" style={{ padding: 26 }}>
          <div className="search-row" style={{ marginBottom: 22 }}>
            <input type="text" placeholder="Search by name" />
            <button className="ghost small">Filter</button>
          </div>

          <div className="list-card">
            {appointments.map((appt) => (
              <div key={appt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{appt.patient}</p>
                  <p className="text-muted" style={{ margin: '6px 0 0' }}>{appt.time}</p>
                  <p className="text-muted" style={{ margin: '6px 0 0' }}>{appt.note}</p>
                </div>
                <button className="ghost small">Cancel</button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
