import { dispensingHistory } from '../../lib/dummy';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function DispensingPage() {
  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Dispensing History</h1>
              <p className="subtitle">Track medications dispensed to patients.</p>
            </div>
          </div>

          <section className="panel hcp-panel">
            <div className="panel-headline-row" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-title">Dispensing Records</p>
                <p className="text-muted">{dispensingHistory.length} records available</p>
              </div>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication</th>
                  <th>Quantity</th>
                  <th>Prescribed By</th>
                  <th>Dispensed Date & Time</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dispensingHistory.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="table-name-cell">
                        <span className="table-avatar">{record.patient.split(' ').map((p) => p[0]).join('')}</span>
                        {record.patient}
                      </div>
                    </td>
                    <td>{record.medication}</td>
                    <td>{record.quantity}</td>
                    <td>{record.doctor}</td>
                    <td>{record.time}</td>
                    <td>
                      <span className={`status-pill status-${record.status.toLowerCase()}`}>
                        {record.status}
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
