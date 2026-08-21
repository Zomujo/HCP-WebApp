"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { hcpPatientApi } from '../lib/api';
import type { Patient } from '../lib/api';

type FilterKey = string;

const getCreatedPatientsStorageKey = (facilityId: string) => `hcp-created-patients:${facilityId}`;

function readCreatedPatients(facilityId: string): Patient[] {
  try {
    const stored = JSON.parse(localStorage.getItem(getCreatedPatientsStorageKey(facilityId)) || '[]');
    return Array.isArray(stored) ? stored.filter((patient) => patient?.id) : [];
  } catch {
    return [];
  }
}

function matchesFilter(patient: Patient, filter: FilterKey): boolean {
  return filter === 'all' || patient.status === filter;
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
  const statusOptions = useMemo(
    () => Array.from(new Set(patients.map((patient) => patient.status).filter(Boolean))) as string[],
    [patients]
  );

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

        const locallyCreatedPatients = readCreatedPatients(facilityId);
        setPatients([
          ...locallyCreatedPatients,
          ...data.filter((patient) => !locallyCreatedPatients.some((localPatient) => localPatient.id === patient.id)),
        ]);
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
    const form = event.currentTarget;
    try {
      setIsRegistering(true);
      setError('');

      const formData = new FormData(form);
      const facilityId = user?.facilityId || user?.facility?.id;
      const selectedCondition = String(formData.get('chronicConditions') || '');
      const chronicConditions = selectedCondition === 'both'
        ? ['hypertension', 'diabetes']
        : selectedCondition
          ? [selectedCondition]
          : [];
      const dateOfBirthValue = String(formData.get('dateOfBirth') || '');

      if (!facilityId) {
        setError('Your facility could not be identified.');
        return;
      }

      const createdPatientId = await hcpPatientApi.createPatient({
        ghanaCardNumber: String(formData.get('ghanaCardNumber') || '').trim(),
        nhisNumber: String(formData.get('nhisNumber') || '').trim(),
        phoneNumber: String(formData.get('phoneNumber') || '').trim(),
        dateOfBirth: dateOfBirthValue,
        gender: String(formData.get('gender') || 'other') as 'male' | 'female' | 'other',
        chronicConditions,
        firstname: String(formData.get('firstname') || '').trim(),
        lastname: String(formData.get('lastname') || '').trim(),
        age: Number(formData.get('age')),
        facilityId,
      });

      if (createdPatientId) {
        let createdPatient: Patient = {
          id: createdPatientId,
          firstName: String(formData.get('firstname') || '').trim(),
          lastName: String(formData.get('lastname') || '').trim(),
          name: `${String(formData.get('firstname') || '').trim()} ${String(formData.get('lastname') || '').trim()}`.trim(),
          age: Number(formData.get('age')),
          gender: String(formData.get('gender') || ''),
          chronicConditions,
          ghanaCard: String(formData.get('ghanaCardNumber') || '').trim(),
          nhis: String(formData.get('nhisNumber') || '').trim(),
        };

        try {
          createdPatient = await hcpPatientApi.getPatientById(createdPatientId);
        } catch {
          // Keep the confirmed create response visible while the detail endpoint catches up.
        }

        const storageKey = getCreatedPatientsStorageKey(facilityId);
        const locallyCreatedPatients = readCreatedPatients(facilityId).filter((patient) => patient.id !== createdPatientId);
        localStorage.setItem(storageKey, JSON.stringify([createdPatient, ...locallyCreatedPatients]));

        let refreshedPatients: Patient[] = [];
        try {
          refreshedPatients = await hcpPatientApi.getPatientsWithOptions({
            page: 1,
            pageSize: 100,
            facilityId,
          });
        } catch {
          // The confirmed local record remains visible if the list endpoint is temporarily stale.
        }

        setPatients([
          createdPatient,
          ...refreshedPatients.filter((patient) => patient.id !== createdPatientId),
        ]);
        setCurrentPage(1);
      } else {
        const refreshedPatients = await hcpPatientApi.getPatientsWithOptions({
          page: 1,
          pageSize: 100,
          facilityId,
        });
        setPatients(refreshedPatients);
      }
      setShowRegisterModal(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add patient');
    } finally {
      setIsRegistering(false);
    }
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
                <div className="filter-groups" aria-label="Patient status filters">
                  <button type="button" className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All</button>
                  <div className="filter-group">
                    <span className="filter-group-label">Status</span>
                    <div className="filter-row">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`filter-pill ${activeFilter === status ? 'active' : ''}`}
                          onClick={() => setActiveFilter(status)}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
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

                <form onSubmit={handleRegisterPatient}>
                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">First name</span>
                      <input name="firstname" required placeholder="First name" disabled={isRegistering} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Last name</span>
                      <input name="lastname" required placeholder="Last name" disabled={isRegistering} />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Age</span>
                      <input name="age" type="number" min={1} required placeholder="Age" disabled={isRegistering} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Date of birth</span>
                      <input name="dateOfBirth" type="date" required disabled={isRegistering} />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Gender</span>
                      <select name="gender" required defaultValue="" disabled={isRegistering}>
                        <option value="" disabled>Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label>
                      <span className="onboarding-field-label">Phone number</span>
                      <input name="phoneNumber" type="tel" required placeholder="+2335544123" inputMode="tel" pattern="\+233[0-9]{7,9}" title="Use a Ghana number beginning with +233" disabled={isRegistering} />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Ghana Card number</span>
                      <input name="ghanaCardNumber" required placeholder="GHA-123456789-0" disabled={isRegistering} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">NHIS number</span>
                      <input name="nhisNumber" required placeholder="NHIS-123456789" disabled={isRegistering} />
                    </label>
                  </div>

                  <label>
                    <span className="onboarding-field-label">Chronic condition</span>
                    <select name="chronicConditions" required defaultValue="" disabled={isRegistering}>
                      <option value="" disabled>Select condition</option>
                      <option value="hypertension">Hypertension</option>
                      <option value="diabetes">Diabetes</option>
                      <option value="both">Hypertension and diabetes</option>
                    </select>
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="ghost small" onClick={() => setShowRegisterModal(false)} disabled={isRegistering}>Cancel</button>
                    <button type="submit" className="primary small" disabled={isRegistering}>{isRegistering ? 'Adding...' : 'Add patient'}</button>
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
