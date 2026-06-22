import { profileData } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function ProfilePage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="app-header">
          <div>
            <h1 className="page-title">Profile</h1>
            <p className="subtitle">Your Healthcare Professional account.</p>
          </div>
        </div>

        <div className="panel" style={{ padding: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
            <div className="avatar-badge" style={{ width: 70, height: 70, fontSize: '1.2rem' }}>{profileData.name.split(' ').map((word) => word[0]).join('')}</div>
            <div>
              <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{profileData.name}</p>
              <p className="text-muted" style={{ margin: '6px 0 0' }}>{profileData.title}</p>
              {profileData.verified && <span className="badge" style={{ marginTop: 10, background: '#d1fae5', color: '#064e3b' }}>Verified</span>}
            </div>
          </div>

          <div className="patient-detail-grid" style={{ marginBottom: 24, padding: '20px', borderRadius: 22, background: '#f8fafc' }}>
            <div>
              <p className="block-label">Facility</p>
              <p style={{ margin: 6, fontWeight: 700 }}>{profileData.facility}</p>
            </div>
            <div>
              <p className="block-label">Ghana Card</p>
              <p style={{ margin: 6, fontWeight: 700 }}>{profileData.ghanaCard}</p>
            </div>
          </div>

          <div className="patient-detail-grid" style={{ marginBottom: 24, padding: '20px', borderRadius: 22, background: '#f8fafc' }}>
            <div>
              <p className="block-label">Email</p>
              <p style={{ margin: 6, fontWeight: 700 }}>{profileData.email}</p>
            </div>
            <div>
              <p className="block-label">Patients in care</p>
              <p style={{ margin: 6, fontWeight: 700 }}>{profileData.patients}</p>
            </div>
          </div>

          <button className="ghost small">Sign out</button>
        </div>
      </main>
    </div>
  );
}
