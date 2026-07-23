"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { hcpPatientApi } from '../lib/api';
import type { Patient } from '../lib/api';

type FilterKey = 'all' | 'hypertension' | 'diabetes' | 'both' | 'critical' | 'silent' | 'stable';

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'both', label: 'Both' },
  { key: 'critical', label: 'Critical' },
  { key: 'silent', label: 'Silent' },
  { key: 'stable', label: 'Stable' },
];

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setIsLoading(true);
        setError('');

        const data =
          activeFilter === 'all'
            ? await hcpPatientApi.getPatients(1, 100)
            : await hcpPatientApi.getPatientsWithOptions({
                page: 1,
                pageSize: 100,
                filterBy: activeFilter,
              });

        setPatients(data);
      } catch (err) {
        console.error('Failed to load patients:', err);
        setError('Failed to load patients');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatients();
  }, [activeFilter]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      return (
        fullName.includes(query) ||
        patient.id.toLowerCase().includes(query) ||
        (patient.ghanaCard || '').toLowerCase().includes(query)
      );
    });
  }, [patients, searchQuery]);

  const handleRegisterPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // This would typically send data to an API endpoint
    // For now, we'll just close the modal
    // In a real app, you might use: await patientApi.registerPatient(...)
    setShowRegisterModal(false);
    event.currentTarget.reset();
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patients</h1>
              <p className="subtitle">{isLoading ? 'Loading...' : `${patients.length} patients in your care.`}</p>
            </div>
            <button className="primary small" onClick={() => setShowRegisterModal(true)}>+ Register patient</button>
          </div>

          {error && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fee', 
              borderRadius: '6px',
              border: '1px solid #fcc',
              color: '#c33',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              Loading patients...
            </div>
          ) : (
            <div className="panel hcp-panel">
              <div className="search-row" style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Search by name, ID, Ghana Card"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div className="filter-row">
                  {FILTER_OPTIONS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`filter-pill ${activeFilter === filter.key ? 'active' : ''}`}
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
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
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td>
                          <div className="table-name-cell">
                            <span className="table-avatar">{getInitials(patient.firstName, patient.lastName)}</span>
                            {patient.firstName} {patient.lastName}
                          </div>
                        </td>
                        <td>{patient.age}</td>
                        <td>{patient.chronicConditions?.join(', ') || 'N/A'}</td>
                        <td>{patient.lastCheckIn || 'N/A'}</td>
                        <td className="adherence-cell">{patient.adherence || 'N/A'}</td>
                        <td>
                          <span className={`status-pill status-${(patient.status || 'stable').toLowerCase()}`}>
                            {patient.status || 'Stable'}
                          </span>
                        </td>
                        <td className="row-arrow">
                          <Link href={`/patients/${patient.id}`} aria-label={`Open patient details`}>
                            &gt;
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        No patients found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showRegisterModal && (
            <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
              <aside
                className="panel hcp-panel appointment-modal-preview appointment-modal-overlay"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Register patient"
              >
                <div className="modal-head-row">
                  <p className="panel-title" style={{ margin: 0 }}>Register patient</p>
                  <button
                    type="button"
                    className="modal-close"
                    aria-label="Close modal"
                    onClick={() => setShowRegisterModal(false)}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleRegisterPatient}>
                  <label>
                    <span className="onboarding-field-label">Full name</span>
                    <input name="fullName" required placeholder="Enter patient name" />
                  </label>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Age</span>
                      <input name="age" type="number" min={1} required placeholder="Age" />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Condition</span>
                      <input name="condition" required placeholder="Hypertension / Diabetes" />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Ghana Card</span>
                      <input name="ghanaCard" placeholder="GHA-XXXXXXX-0000" />
                    </label>
                    <label>
                      <span className="onboarding-field-label">NHIS</span>
                      <input name="nhis" placeholder="XXXX-XXXX-XX" />
                    </label>
                  </div>

                  <label>
                    <span className="onboarding-field-label">Facility</span>
                    <input name="facility" placeholder="Kumasi South Hospital" />
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="ghost small" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                    <button type="submit" className="primary small">Register patient</button>
                  </div>
                </form>
              </aside>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
