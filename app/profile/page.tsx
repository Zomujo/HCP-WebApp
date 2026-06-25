import { profileData } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function ProfilePage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content hcp-page">
        <div className="hcp-page-header">
          <div>
            <h1 className="hcp-page-title">Profile</h1>
            <p className="subtitle">Your Healthcare Professional account.</p>
          </div>
        </div>

        <div className="profile-wrap">
          <div className="panel hcp-panel">
            <div className="profile-head">
              <div className="profile-photo">AO</div>
              <div>
                <p className="profile-name">{profileData.name}</p>
                <p className="text-muted" style={{ margin: '2px 0 0' }}>{profileData.title}</p>
                {profileData.verified && <span className="badge profile-verified">Verified</span>}
              </div>
            </div>
          </div>

          <div className="panel hcp-panel">
            <div className="profile-info-block">
              <div>
                <p className="block-label">Facility</p>
                <p>{profileData.facility}</p>
              </div>
              <div>
                <p className="block-label">Ghana Card</p>
                <p>{profileData.ghanaCard}</p>
              </div>
              <div>
                <p className="block-label">Email</p>
                <p>{profileData.email}</p>
              </div>
              <div>
                <p className="block-label">Patients in care</p>
                <p>{profileData.patients}</p>
              </div>
            </div>
          </div>

          <button className="ghost small profile-signout">Sign out</button>
        </div>
      </main>
    </div>
  );
}
