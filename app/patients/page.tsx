import { patientList } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function PatientsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content hcp-page">
        <div className="hcp-page-header">
          <div>
            <h1 className="hcp-page-title">Patients</h1>
            <p className="subtitle">8 patients in your care.</p>
          </div>
          <button className="primary small">+ Add patient</button>
        </div>

        <div className="panel hcp-panel">
          <div className="search-row" style={{ marginBottom: 16 }}>
            <input type="text" placeholder="Search by name, ID, hosp. number" />
            <div className="filter-row">
              <span className="filter-pill active">All</span>
              <span className="filter-pill">Hypertension</span>
              <span className="filter-pill">Diabetes</span>
              <span className="filter-pill">Both</span>
              <span className="filter-pill">Critical</span>
              <span className="filter-pill">Silent</span>
              <span className="filter-pill">Stable</span>
            </div>
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
              {patientList.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <div className="table-name-cell">
                      <span className="table-avatar">{patient.initials}</span>
                      {patient.name}
                    </div>
                  </td>
                  <td>{patient.age}</td>
                  <td>{patient.condition}</td>
                  <td>{patient.lastCheckIn}</td>
                  <td className="adherence-cell">{patient.adherence}</td>
                  <td>
                    <span className={`status-pill status-${patient.status.toLowerCase()}`}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="row-arrow">&gt;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
