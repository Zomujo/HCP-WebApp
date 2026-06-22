import { dashboardStats, weeklyAppointments, recentReadings } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';

function statCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="small-card card-compact">
      <p className="overline">{label}</p>
      <p style={{ margin: '12px 0 0', fontSize: '2rem', fontWeight: 700 }}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
        <div className="app-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="subtitle">A snapshot of your clinic workload and patient safety signals.</p>
          </div>
        </div>

        <div className="card-row">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="small-card">
              <p className="overline">{stat.label}</p>
              <p style={{ marginTop: 12, fontSize: '2rem', fontWeight: 700 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="panel" style={{ marginTop: 24, padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <div>
              <p className="overline">Clinic Visits This Week</p>
              <p className="text-muted" style={{ margin: 6 }}>9 Total Appointments • Next: Today 1:30 PM</p>
            </div>
            <button className="ghost small">See All Appointments</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 14 }}>
            {weeklyAppointments.map((item) => (
              <div key={item.day} style={{ background: item.active ? '#fef3c7' : '#f8fafc', borderRadius: 18, padding: 18, textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{item.day}</p>
                <p style={{ margin: '8px 0 0', fontSize: '1.35rem', fontWeight: 700 }}>{item.value}</p>
                <p className="text-muted" style={{ margin: '10px 0 0' }}>{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 24, padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <p className="overline">Recent Readings</p>
            </div>
            <button className="ghost small">See All Appointments</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Condition</th>
                <th>Last check-in</th>
                <th>Adherence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentReadings.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.age}</td>
                  <td>{row.condition}</td>
                  <td>{row.lastCheckIn}</td>
                  <td>{row.adherence}</td>
                  <td>
                    <span className={`status-pill status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
    </ProtectedRoute>
  );
}
