"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { authApi } from '../lib/api';

const DELETE_CONFIRM_PHRASE = 'DELETE';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  const isPharmacy = user?.role === 'pharmacy-personnel';
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const fullName = [firstName, user?.lastName].filter(Boolean).join(' ');
  const roleLabel = isPharmacy ? 'Pharmacy personnel' : 'Healthcare professional';
  const facilityName = isPharmacy
    ? user?.firstName || 'Pharmacy'
    : user?.facility?.name || 'Not assigned';
  const maskedCard = user?.personnelId
    ? `GHA-XXXXX-${user.personnelId.slice(-4).toUpperCase()}`
    : 'Not available';

  const initials = (() => {
    if (!user) return 'U';
    const first = user.firstName?.[0] || user.email?.[0] || 'U';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase();
  })();

  useEffect(() => {
    if (!showDeleteModal) return;
    confirmInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) closeDeleteModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDeleteModal, isDeleting]);

  const handleSignOut = () => {
    logout();
    router.replace('/login');
  };

  const openDeleteModal = () => {
    setConfirmText('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmText('');
    setDeleteError('');
  };

  const canConfirmDelete = confirmText.trim().toUpperCase() === DELETE_CONFIRM_PHRASE && !isDeleting;

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfirmDelete) return;

    setIsDeleting(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete your account. Please try again.');
      setIsDeleting(false);
      return;
    }

    // Account is gone server-side: clear local session and leave the protected area.
    logout();
    router.replace('/signup');
  };

  const details = [
    { label: 'Full name', value: fullName },
    { label: 'Email address', value: user?.email || 'Not available' },
    { label: 'Role', value: roleLabel },
    { label: isPharmacy ? 'Pharmacy' : 'Facility', value: facilityName },
    { label: 'Ghana Card', value: maskedCard },
  ];

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Profile</h1>
              <p className="subtitle">Manage your account details and access.</p>
            </div>
          </div>

          <div className="pf-wrap">
            <section className="pf-card pf-hero">
              <div className="pf-avatar" aria-hidden="true">{initials}</div>
              <div className="pf-hero-text">
                <h2 className="pf-name">{fullName}</h2>
                <p className="pf-meta">{roleLabel} · {facilityName}</p>
                <div className="pf-tags">
                  <span className="pf-tag pf-tag-success"><span className="pf-dot" />Active</span>
                  {user && <span className="pf-tag">Verified</span>}
                </div>
              </div>
              <button type="button" className="pf-btn pf-btn-outline pf-hero-action" onClick={handleSignOut}>
                Sign out
              </button>
            </section>

            <section className="pf-card">
              <header className="pf-card-head">
                <h3>Personal details</h3>
                <p>Information linked to your personnel account.</p>
              </header>
              <dl className="pf-details">
                {details.map((item) => (
                  <div className="pf-row" key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="pf-card pf-danger">
              <div className="pf-danger-text">
                <h3>Delete account</h3>
                <p>
                  Permanently remove your personnel account and all access to this workspace.
                  This cannot be undone.
                </p>
              </div>
              <button type="button" className="pf-btn pf-btn-danger" onClick={openDeleteModal}>
                Delete account
              </button>
            </section>
          </div>

          {showDeleteModal && (
            <div className="pf-modal-backdrop" onClick={() => !isDeleting && closeDeleteModal()}>
              <form
                className="pf-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pf-delete-title"
                onClick={(event) => event.stopPropagation()}
                onSubmit={handleDeleteAccount}
              >
                <div className="pf-modal-icon" aria-hidden="true">!</div>
                <h3 id="pf-delete-title">Delete your account?</h3>
                <p className="pf-modal-body">
                  This permanently deletes the account for <strong>{user?.email}</strong> and signs you out.
                  You will lose access to your patients, appointments and records in this workspace.
                </p>
                <label className="pf-modal-label" htmlFor="pf-delete-confirm">
                  Type <strong>{DELETE_CONFIRM_PHRASE}</strong> to confirm
                </label>
                <input
                  id="pf-delete-confirm"
                  ref={confirmInputRef}
                  className="pf-modal-input"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  autoComplete="off"
                  disabled={isDeleting}
                />
                {deleteError && <p className="pf-error" role="alert">{deleteError}</p>}
                <div className="pf-modal-actions">
                  <button type="button" className="pf-btn pf-btn-outline" onClick={closeDeleteModal} disabled={isDeleting}>
                    Cancel
                  </button>
                  <button type="submit" className="pf-btn pf-btn-danger-solid" disabled={!canConfirmDelete}>
                    {isDeleting ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
