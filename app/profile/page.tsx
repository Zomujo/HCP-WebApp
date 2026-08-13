"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { authApi } from '../lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'This permanently deletes your personnel account and signs you out. This action cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setDeleteError('');
      await authApi.deleteAccount();
      logout();
      router.replace('/signup');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete your account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = () => {
    if (!user) return 'U';
    const first = user.firstName?.[0] || user.email?.[0] || 'U';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Profile</h1>
              <p className="subtitle">Your Healthcare Professional account.</p>
            </div>
          </div>

          <div className="profile-wrap profile-wrap-wide">
            <section className="profile-hero">
              <div className="profile-head">
                <div className="profile-photo">{getInitials()}</div>
                <div>
                  <p className="profile-name">{user?.firstName || user?.email?.split('@')[0] || 'User'} {user?.lastName || ''}</p>
                  <p className="profile-role">{user?.role === 'pharmacy-personnel' ? 'Pharmacy personnel' : 'Healthcare professional'}</p>
                  {user && <span className="badge profile-verified">Verified</span>}
                </div>
              </div>
            </section>

            <section className="panel hcp-panel profile-data-card">
              <div className="profile-section-heading">
                <div>
                  <p className="eyebrow">Account overview</p>
                  <h2>Personal details</h2>
                </div>
                <span className="profile-status-dot">Active</span>
              </div>
              <div className="profile-info-block">
                <div>
                  <p className="block-label">Facility</p>
                  <p>{user?.role === 'pharmacy-personnel'
                    ? user?.firstName || 'Pharmacy'
                    : user?.facility?.name || 'Kumasi South Hospital'}</p>
                </div>
                <div>
                  <p className="block-label">Ghana Card</p>
                  <p>{user?.personnelId ? `GHA-XXXXX-${user.personnelId.slice(-4).toUpperCase()}` : 'Not available'}</p>
                </div>
                <div>
                  <p className="block-label">Email</p>
                  <p>{user?.email}</p>
                </div>
              </div>
            </section>

            <section className="profile-actions">
              <button className="ghost small profile-signout" onClick={handleSignOut}>Sign out</button>
            </section>

            <section className="panel hcp-panel profile-danger-zone">
              <div>
                <p className="eyebrow danger-eyebrow">Danger zone</p>
                <h2>Delete account</h2>
                <p className="text-muted">Permanently remove your personnel account and sign out of this device.</p>
              </div>
              {deleteError && <p className="profile-error" role="alert">{deleteError}</p>}
              <button className="danger-button" onClick={handleDeleteAccount} disabled={isDeleting}>
                {isDeleting ? 'Deleting account...' : 'Delete account'}
              </button>
            </section>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
