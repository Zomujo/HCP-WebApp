"use client";

import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, resetAccount } = useAuth();

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  const handleDeleteAndRestart = () => {
    const confirmed = window.confirm(
      'This will clear your current account session on this device and take you to signup. Continue?'
    );

    if (!confirmed) {
      return;
    }

    resetAccount();
    router.push('/signup');
  };

  const getInitials = () => {
    if (!user) return 'U';
    const first = user.firstName?.[0] || user.email?.[0] || 'U';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  return (
    <ProtectedRoute requiredRole="health-worker">
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
                <div className="profile-photo">{getInitials()}</div>
                <div>
                  <p className="profile-name">{user?.firstName || user?.email?.split('@')[0] || 'User'} {user?.lastName || ''}</p>
                  <p className="text-muted" style={{ margin: '2px 0 0' }}>Health Worker</p>
                  {user && <span className="badge profile-verified">Verified</span>}
                </div>
              </div>
            </div>

            <div className="panel hcp-panel">
              <div className="profile-info-block">
                <div>
                  <p className="block-label">Facility</p>
                  <p>{user?.facility?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="block-label">Email</p>
                  <p>{user?.email}</p>
                </div>
                <div>
                  <p className="block-label">Role</p>
                  <p>{user?.role === 'health-worker' ? 'Health Worker' : 'Pharmacy Personnel'}</p>
                </div>
              </div>
            </div>

            <div className="panel hcp-panel" style={{ marginTop: 12 }}>
              <p className="block-label" style={{ marginBottom: 8 }}>Having onboarding/account issues?</p>
              <p className="text-muted" style={{ marginBottom: 12 }}>
                Use this to clear the current account data on this browser and sign up again.
              </p>
              <button className="ghost small" onClick={handleDeleteAndRestart}>
                Delete account and sign up again
              </button>
            </div>

            <button className="ghost small profile-signout" onClick={handleSignOut}>Sign out</button>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
