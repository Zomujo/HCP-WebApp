import { dashboardStats, weeklyAppointments, recentReadings } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRole="doctor">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Dashboard</h1>
              <p className="subtitle">A snapshot of your clinic workload and patient safety signals.</p>
            </div>
          </div>

          <section className="stats-row-figma">
            {dashboardStats.map((stat) => (
              <div key={stat.label} className="stat-box-figma">
                <p className="overline">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            ))}
          </section>

          <section className="panel hcp-panel" style={{ marginTop: 18 }}>
            <div className="panel-headline-row">
              <div>
                <p className="panel-title">Clinic Visits This Week</p>
                <p className="text-muted">9 Total Appointments • Next: Today 1:30 PM</p>
              </div>
              <button className="text-link">See All Appointments</button>
            </div>

            <div className="week-grid-figma">
              {weeklyAppointments.map((item) => (
                <div key={item.day} className={`week-cell ${item.active ? 'active' : ''}`}>
                  <p>{item.day}</p>
                  <strong>{item.value}</strong>
                  <span>{item.note}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel hcp-panel" style={{ marginTop: 18 }}>
            <div className="panel-headline-row" style={{ marginBottom: 10 }}>
              <p className="panel-title">Recent Readings</p>
              <button className="text-link">See All Appointments</button>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Condition</th>
                  <th>Last check-in</th>
                  <th>Adherence</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recentReadings.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <div className="table-name-cell">
                        <span className="table-avatar">{row.name.split(' ').map((p) => p[0]).join('')}</span>
                        {row.name}
                      </div>
                    </td>
                    <td>{row.age}</td>
                    <td>{row.condition}</td>
                    <td>{row.lastCheckIn}</td>
                    <td className="adherence-cell">{row.adherence}</td>
                    <td>
                      <span className={`status-pill status-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="row-arrow">&gt;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
