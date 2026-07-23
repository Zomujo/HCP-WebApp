import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function PharmacyDashboardPage() {
  const pharmacyDashboardStats = [
    { label: 'Registered Patients', value: '137' },
    { label: 'Unread Messages', value: '12' },
    { label: 'Active Team Members', value: '6' },
  ];

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Pharmacy Dashboard</h1>
              <p className="subtitle">Overview of pharmacy patients and team communication.</p>
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
            <div className="panel-headline-row" style={{ marginBottom: 10 }}>
              <p className="panel-title">Quick Access</p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/pharmacy/patients" className="ghost">
                Open Patients
              </Link>
              <Link href="/pharmacy/chats" className="ghost">
                Open Chats
              </Link>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
