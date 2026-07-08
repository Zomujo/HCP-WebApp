import { pharmacyDashboardStats, pendingPrescriptions, inventoryItems } from '../../lib/dummy';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function PharmacyDashboardPage() {
  const lowStockItems = inventoryItems.filter(item => item.status === 'Low' || item.status === 'Critical');

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Pharmacy Dashboard</h1>
              <p className="subtitle">Manage prescriptions, inventory, and dispensing activities.</p>
            </div>
          </div>

          <section className="stats-row-figma">
            {pharmacyDashboardStats.map((stat) => (
              <div key={stat.label} className="stat-box-figma">
                <p className="overline">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            ))}
          </section>

          <section className="panel hcp-panel" style={{ marginTop: 18 }}>
            <div className="panel-headline-row">
              <div>
                <p className="panel-title">Pending Prescriptions</p>
                <p className="text-muted">{pendingPrescriptions.length} prescriptions awaiting processing</p>
              </div>
              <button className="text-link">See All Prescriptions</button>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication</th>
                  <th>Qty</th>
                  <th>Health Worker</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingPrescriptions.slice(0, 3).map((rx) => (
                  <tr key={rx.id}>
                    <td>{rx.patient}</td>
                    <td>{rx.medication}</td>
                    <td>{rx.quantity}</td>
                    <td>{rx.doctor}</td>
                    <td>{rx.time}</td>
                    <td>
                      <span className={`status-pill status-${rx.status.toLowerCase()}`}>
                        {rx.status}
                      </span>
                    </td>
                    <td className="row-arrow">&gt;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel hcp-panel" style={{ marginTop: 18 }}>
            <div className="panel-headline-row" style={{ marginBottom: 10 }}>
              <p className="panel-title">Low Stock Alert</p>
              <button className="text-link">Manage Inventory</button>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Current Stock</th>
                  <th>Minimum Level</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.stock}</td>
                    <td>{item.minimum}</td>
                    <td>
                      <span className={`status-pill status-${item.status.toLowerCase()}`}>
                        {item.status}
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
