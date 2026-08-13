"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { hcpPatientApi } from '../lib/api';
import type { Patient } from '../lib/api';

type FilterKey =
  | 'all'
  | 'bp-normal'
  | 'bp-elevated'
  | 'bp-stage-1'
  | 'bp-stage-2'
  | 'bp-severe'
  | 'glucose-critical-low'
  | 'glucose-low'
  | 'glucose-target'
  | 'glucose-slightly-high'
  | 'glucose-high'
  | 'glucose-very-high'
  | 'glucose-critical';

const FILTER_GROUPS: Array<{ label: string; options: Array<{ key: FilterKey; label: string }> }> = [
  {
    label: 'Blood pressure',
    options: [
      { key: 'bp-normal', label: 'Normal' },
      { key: 'bp-elevated', label: 'Elevated' },
      { key: 'bp-stage-1', label: 'Stage 1 Hypertension' },
      { key: 'bp-stage-2', label: 'Stage 2 Hypertension' },
      { key: 'bp-severe', label: 'Severely High / Critical' },
    ],
  },
  {
    label: 'Blood glucose',
    options: [
      { key: 'glucose-critical-low', label: 'Critically Low' },
      { key: 'glucose-low', label: 'Low' },
      { key: 'glucose-target', label: 'In Target' },
      { key: 'glucose-slightly-high', label: 'Slightly High' },
      { key: 'glucose-high', label: 'High' },
      { key: 'glucose-very-high', label: 'Very High' },
      { key: 'glucose-critical', label: 'Critical' },
    ],
  },
];

function matchesFilter(patient: Patient, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter.startsWith('glucose-')) {
    const glucose = patient.bloodSugar;
    if (glucose === undefined) return false;
    if (filter === 'glucose-critical-low') return glucose < 54;
    if (filter === 'glucose-low') return glucose >= 54 && glucose <= 69;
    if (filter === 'glucose-target') return glucose >= 80 && glucose <= 130;
    if (filter === 'glucose-slightly-high') return glucose >= 131 && glucose <= 179;
    if (filter === 'glucose-high') return glucose >= 180 && glucose <= 249;
    if (filter === 'glucose-very-high') return glucose >= 250 && glucose <= 299;
    return glucose >= 300;
  }

  const bloodPressure = patient.vitals;
  if (!bloodPressure) return false;
  const { systolic, diastolic } = bloodPressure;
  if (filter === 'bp-normal') return systolic < 120 && diastolic < 80;
  if (filter === 'bp-elevated') return systolic >= 120 && systolic <= 129 && diastolic < 80;
  if (filter === 'bp-stage-1') return (systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89);
  if (filter === 'bp-stage-2') return (systolic >= 140 && systolic < 180) || (diastolic >= 90 && diastolic < 120);
  return systolic >= 180 || diastolic >= 120;
}

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setIsLoading(true);
        setError('');

        const facilityId = user?.facilityId || user?.facility?.id;
        if (!facilityId) {
          setPatients([]);
          setIsLoading(false);
          return;
        }

        const data = await hcpPatientApi.getPatientsWithOptions({
          page: 1,
          pageSize: 100,
          facilityId,
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
  }, [user?.facilityId, user?.facility?.id]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      if (!matchesFilter(patient, activeFilter)) return false;
      if (!query) return true;
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      return (
        fullName.includes(query) ||
        patient.id.toLowerCase().includes(query) ||
        (patient.ghanaCard || '').toLowerCase().includes(query)
      );
    });
  }, [patients, searchQuery, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));

  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
            <button className="primary small" onClick={() => setShowRegisterModal(true)}>+ Add patient</button>
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
                  placeholder="Search by name, ID, hosp. number"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div className="filter-groups" aria-label="Clinical filters">
                  <button type="button" className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All</button>
                  {FILTER_GROUPS.map((group) => (
                    <div key={group.label} className="filter-group">
                      <span className="filter-group-label">{group.label}</span>
                      <div className="filter-row">
                        {group.options.map((filter) => (
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
                  ))}
                </div>
              </div>

              <table className="table hcp-table hcp-patients-table">
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
                  {paginatedPatients.length > 0 ? (
                    paginatedPatients.map((patient) => (
                      <tr
                        key={patient.id}
                        onClick={() => router.push(`/patients/${patient.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
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
                          <Link
                            href={`/patients/${patient.id}`}
                            aria-label={`Open patient details`}
                            onClick={(event) => event.stopPropagation()}
                          >
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

              {filteredPatients.length > pageSize && (
                <div className="table-pagination-row">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <p className="text-muted" style={{ margin: 0 }}>
                    Page {currentPage} of {totalPages}
                  </p>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
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

                <form
                  onSubmit={(event) => {
                    const form = event.currentTarget;
                    const phoneInput = form.elements.namedItem('phone') as HTMLInputElement | null;
                    const phoneValue = phoneInput?.value?.trim() || '';

                    if (phoneValue && !/^\+233\d{9}$/.test(phoneValue)) {
                      event.preventDefault();
                      phoneInput?.setCustomValidity('Use the format +233XXXXXXXXX');
                      phoneInput?.reportValidity();
                      return;
                    }

                    if (phoneInput) {
                      phoneInput.setCustomValidity('');
                    }

                    handleRegisterPatient(event);
                  }}
                >
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
                      <select name="condition" required defaultValue="">
                        <option value="" disabled>Select condition</option>
                        <option value="hypertension">Hypertension</option>
                        <option value="diabetes">Diabetes</option>
                        <option value="both">Hypertension and Diabetes</option>
                      </select>
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Phone number</span>
                      <input
                        name="phone"
                        type="tel"
                        placeholder="+233XXXXXXXXX"
                        inputMode="tel"
                        pattern="\+233[0-9]{9}"
                        title="Use the format +233XXXXXXXXX"
                      />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Ghana Card</span>
                      <input name="ghanaCard" placeholder="GHA-XXXXXXX-0000" />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">NHIS</span>
                      <input name="nhis" placeholder="XXXX-XXXX-XX" />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Facility</span>
                      <input name="facility" placeholder="Kumasi South Hospital" />
                    </label>
                  </div>

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
