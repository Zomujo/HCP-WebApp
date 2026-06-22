import { patientList } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function PatientsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="app-header">
          <div>
            <h1 className="page-title">Patients</h1>
            <p className="subtitle">8 patients in your care.</p>
          </div>
          <button className="primary small">+ Add patient</button>
        </div>

        <div className="panel" style={{ padding: 26 }}>
          <div className="search-row" style={{ marginBottom: 24 }}>
            <input type="text" placeholder="Search by name, ID, hosp. number" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="filter-pill">All</span>
              <span className="filter-pill">Hypertension</span>
              <span className="filter-pill">Diabetes</span>
              <span className="filter-pill">Both</span>
              <span className="filter-pill">Critical</span>
              <span className="filter-pill">Silent</span>
              <span className="filter-pill">Stable</span>
            </div>
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
              {patientList.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.name}</td>
                  <td>{patient.age}</td>
                  <td>{patient.condition}</td>
                  <td>{patient.lastCheckIn}</td>
                  <td>{patient.adherence}</td>
                  <td>
                    <span className={`status-pill status-${patient.status.toLowerCase()}`}>
                      {patient.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
