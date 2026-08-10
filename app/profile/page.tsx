"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { ApiError, PersonnelAccount, personnelAccountsApi } from '../lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, resetAccount } = useAuth();
  const [accounts, setAccounts] = useState<PersonnelAccount[]>([]);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsTotalPages, setAccountsTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountsError, setAccountsError] = useState('');
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [editingAccountId, setEditingAccountId] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);

  const pageSize = 10;

  const loadAccounts = async (page: number, search: string) => {
    try {
      setIsAccountsLoading(true);
      setAccountsError('');
      const result = await personnelAccountsApi.list(page, pageSize, search);
      setAccounts(result.rows);
      setAccountsTotalPages(Math.max(result.totalPages || 1, 1));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load personnel accounts.';
      setAccountsError(message);
    } finally {
      setIsAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAccounts(accountsPage, searchQuery);
  }, [user, accountsPage, searchQuery]);

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountsPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleCreateEmailAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = newEmail.trim();
    if (!email) {
      setAccountsError('Email is required to create a linked email account.');
      return;
    }

    if (newPassword.length < 8) {
      setAccountsError('Password must be at least 8 characters.');
      return;
    }

    try {
      setIsCreatingAccount(true);
      setAccountsError('');
      await personnelAccountsApi.create({
        provider: 'email',
        email,
        password: newPassword,
      });
      setNewEmail('');
      setNewPassword('');
      await loadAccounts(accountsPage, searchQuery);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create personnel account.';
      setAccountsError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleStartEdit = async (accountId: string) => {
    try {
      setAccountsError('');
      const account = await personnelAccountsApi.getById(accountId);
      setEditingAccountId(account.id);
      setEditingEmail(account.email);
      setEditingPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load personnel account details.';
      setAccountsError(message);
    }
  };

  const handleUpdateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingAccountId) return;

    const payload: { email?: string; password?: string; provider?: 'email' | 'google' } = {
      provider: 'email',
    };

    const normalizedEmail = editingEmail.trim();
    if (normalizedEmail) {
      payload.email = normalizedEmail;
    }

    if (editingPassword.trim()) {
      if (editingPassword.length < 8) {
        setAccountsError('Updated password must be at least 8 characters.');
        return;
      }
      payload.password = editingPassword;
    }

    try {
      setIsUpdatingAccount(true);
      setAccountsError('');
      await personnelAccountsApi.update(editingAccountId, payload);
      setEditingPassword('');
      await loadAccounts(accountsPage, searchQuery);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAccountsError('An account with that email already exists.');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to update personnel account.';
        setAccountsError(message);
      }
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const confirmed = window.confirm('Delete this linked account? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setAccountsError('');
      await personnelAccountsApi.remove(accountId);
      if (editingAccountId === accountId) {
        setEditingAccountId('');
        setEditingEmail('');
        setEditingPassword('');
      }
      await loadAccounts(accountsPage, searchQuery);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete personnel account.';
      setAccountsError(message);
    }
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

          <div className="profile-wrap profile-wrap-wide">
            <div className="panel hcp-panel profile-summary-card">
              <div className="profile-head">
                <div className="profile-photo">{getInitials()}</div>
                <div>
                  <p className="profile-name">{user?.firstName || user?.email?.split('@')[0] || 'User'} {user?.lastName || ''}</p>
                  <p className="text-muted" style={{ margin: '2px 0 0' }}>Healthcare Professional (HCP)</p>
                  {user && <span className="badge profile-verified">Verified</span>}
                </div>
              </div>
            </div>

            <div className="panel hcp-panel profile-data-card">
              <div className="profile-info-block">
                <div>
                  <p className="block-label">Facility</p>
                  <p>{user?.facility?.name || 'Kumasi South Hospital'}</p>
                </div>
                <div>
                  <p className="block-label">Ghana Card</p>
                  <p>{user?.personnelId ? `GHA-XXXXX-${user.personnelId.slice(-4).toUpperCase()}` : 'Not available'}</p>
                </div>
                <div>
                  <p className="block-label">Email</p>
                  <p>{user?.email}</p>
                </div>
                <div>
                  <p className="block-label">Patients in Care</p>
                  <p>137</p>
                </div>
              </div>
            </div>

            <button className="ghost small profile-signout" onClick={handleSignOut}>Sign out</button>

            <details className="panel hcp-panel profile-advanced">
              <summary>Advanced account settings</summary>
              <p className="text-muted" style={{ marginBottom: 12 }}>
                These tools are available while API migrations are in progress.
              </p>

              <button className="ghost small" onClick={handleDeleteAndRestart} style={{ marginBottom: 12 }}>
                Delete account and sign up again
              </button>

              <form className="auth-fields" onSubmit={handleCreateEmailAccount} style={{ marginBottom: 14 }}>
                <label>
                  <span className="block-label">New Email Account</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="doctor@example.com"
                    autoComplete="email"
                    required
                    disabled={isCreatingAccount}
                  />
                </label>
                <label>
                  <span className="block-label">Temporary Password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                    disabled={isCreatingAccount}
                  />
                </label>
                <button className="ghost small" type="submit" disabled={isCreatingAccount}>
                  {isCreatingAccount ? 'Creating account...' : 'Create linked email account'}
                </button>
              </form>

              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by email"
                  style={{ flex: 1 }}
                  disabled={isAccountsLoading}
                />
                <button type="submit" className="ghost small" disabled={isAccountsLoading}>
                  Search
                </button>
              </form>

              {accountsError && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#fee',
                  borderRadius: '6px',
                  border: '1px solid #fcc',
                  color: '#c33',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  {accountsError}
                </div>
              )}

              {!isAccountsLoading && accounts.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      style={{
                        border: '1px solid #e7ebf1',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 700 }}>{account.email}</p>
                      <p className="text-muted" style={{ margin: 0 }}>
                        Provider: {account.provider} · Linked to: {account.personnel?.facility?.name || 'No facility'}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="ghost small" onClick={() => handleStartEdit(account.id)}>
                          Edit
                        </button>
                        <button type="button" className="ghost small" onClick={() => handleDeleteAccount(account.id)}>
                          Delete
                        </button>
                      </div>

                      {editingAccountId === account.id && (
                        <form className="auth-fields" onSubmit={handleUpdateAccount} style={{ marginTop: 6 }}>
                          <label>
                            <span className="block-label">Email</span>
                            <input
                              type="email"
                              value={editingEmail}
                              onChange={(event) => setEditingEmail(event.target.value)}
                              required
                              disabled={isUpdatingAccount}
                            />
                          </label>
                          <label>
                            <span className="block-label">New Password (optional)</span>
                            <input
                              type="password"
                              value={editingPassword}
                              onChange={(event) => setEditingPassword(event.target.value)}
                              placeholder="Leave blank to keep current password"
                              disabled={isUpdatingAccount}
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="submit" className="ghost small" disabled={isUpdatingAccount}>
                              {isUpdatingAccount ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => {
                                setEditingAccountId('');
                                setEditingEmail('');
                                setEditingPassword('');
                              }}
                              disabled={isUpdatingAccount}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isAccountsLoading && accounts.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setAccountsPage((current) => Math.max(1, current - 1))}
                    disabled={accountsPage <= 1 || isAccountsLoading}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setAccountsPage((current) => Math.min(accountsTotalPages, current + 1))}
                    disabled={accountsPage >= accountsTotalPages || isAccountsLoading}
                  >
                    Next
                  </button>
                  <p className="text-muted" style={{ margin: '6px 0 0 4px' }}>
                    Page {accountsPage} of {accountsTotalPages}
                  </p>
                </div>
              )}
            </details>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
