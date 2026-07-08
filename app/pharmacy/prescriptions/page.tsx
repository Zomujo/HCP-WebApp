import { pendingPrescriptions } from '../../lib/dummy';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function PrescriptionsPage() {
  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Prescriptions Queue</h1>
              <p className="subtitle">Review and process incoming prescriptions from health workers.</p>
            </div>
          </div>

          <section className="panel hcp-panel">
            <div className="panel-headline-row" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-title">All Prescriptions</p>
                <p className="text-muted">{pendingPrescriptions.length} total prescriptions</p>
              </div>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication</th>
                  <th>Quantity</th>
                  <th>Health Worker</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPrescriptions.map((rx) => (
                  <tr key={rx.id}>
                    <td>
                      <div className="table-name-cell">
                        <span className="table-avatar">{rx.patient.split(' ').map((p) => p[0]).join('')}</span>
                        {rx.patient}
                      </div>
                    </td>
                    <td>{rx.medication}</td>
                    <td>{rx.quantity}</td>
                    <td>{rx.doctor}</td>
                    <td>{rx.time}</td>
                    <td>
                      <span className={`status-pill status-${rx.status.toLowerCase()}`}>
                        {rx.status}
                      </span>
                    </td>
                    <td>
                      <button className="text-link">Process</button>
                    </td>
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
