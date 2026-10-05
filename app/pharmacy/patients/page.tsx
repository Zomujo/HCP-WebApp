"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { RegisterPatientModal } from '../../components/RegisterPatientModal';
import { pharmacyPatientApi } from '../../lib/api';
import type { CreatePatientInput, Patient } from '../../lib/api';

const PAGE_SIZE = 10;

function patientName(patient: Patient): string {
  return patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown patient';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatGender(gender?: string): string {
  return gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '—';
}

export default function PharmacyPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      setPatients(await pharmacyPatientApi.getPatients(1, 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [patientName(patient), patient.patientCode, patient.ghanaCard]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }, [patients, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const pagePatients = filteredPatients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setCurrentPage(1), [searchQuery]);

  const handleRegister = async (input: CreatePatientInput) => {
    const id = await pharmacyPatientApi.createPatient(input);
    setShowRegister(false);
    if (id) {
      router.push(`/pharmacy/patients/${id}?registered=1`);
      return;
    }
    setNotice(`${input.firstname} ${input.lastname} was registered.`);
    loadPatients();
  };

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patients</h1>
              <p className="subtitle">
                {isLoading ? 'Loading your patients…' : `${patients.length} ${patients.length === 1 ? 'patient' : 'patients'} registered.`}
              </p>
            </div>
            <button type="button" className="primary small" onClick={() => setShowRegister(true)}>
              <span aria-hidden>+</span> Register patient
            </button>
          </div>

          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <section className="panel hcp-panel">
            <div className="search-row">
              <input
                type="search"
                className="search-input"
                placeholder="Search by name, patient code or Ghana Card"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search patients"
              />
              {!isLoading && searchQuery && (
                <p className="pagination-label">{filteredPatients.length} {filteredPatients.length === 1 ? 'match' : 'matches'}</p>
              )}
            </div>

            {isLoading ? (
              <div className="loading-state" role="status">
                <span className="spinner" aria-hidden />
                Loading patients…
              </div>
            ) : patients.length === 0 ? (
              <div className="empty-state empty-state-cta">
                <div className="empty-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M19 8v6M16 11h6" />
                  </svg>
                </div>
                <p className="empty-title">No patients yet</p>
                <p>Register your first patient to start recording their vitals.</p>
                <button type="button" className="primary small" onClick={() => setShowRegister(true)}>
                  <span aria-hidden>+</span> Register patient
                </button>
              </div>
            ) : (
              <>
                <div className="table-wrap stack-on-mobile">
                  <table className="table hcp-table pharmacy-patients-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>BMI</th>
                        <th>Registered</th>
                        <th aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagePatients.length > 0 ? (
                        pagePatients.map((patient) => {
                          const name = patientName(patient);
                          return (
                            <tr
                              key={patient.id}
                              className="clickable-row"
                              onClick={() => router.push(`/pharmacy/patients/${patient.id}`)}
                            >
                              <td className="cell-primary">
                                <div className="table-name-cell">
                                  <span className="table-avatar">{initials(name)}</span>
                                  <span className="name-stack">
                                    <span>{name}</span>
                                    {patient.patientCode && <span className="name-sub">{patient.patientCode}</span>}
                                  </span>
                                </div>
                              </td>
                              <td data-label="Age">{patient.age ? `${patient.age} yrs` : '—'}</td>
                              <td data-label="Gender">{formatGender(patient.gender)}</td>
                              <td data-label="BMI">{patient.bmi ? patient.bmi.toFixed(1) : '—'}</td>
                              <td data-label="Registered">{patient.joined || '—'}</td>
                              <td className="row-arrow">
                                <Link
                                  href={`/pharmacy/patients/${patient.id}`}
                                  aria-label={`Open ${name}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="empty-cell">
                            <p className="empty-title">No matching patients</p>
                            <p>Try a different name, code or Ghana Card number.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredPatients.length > PAGE_SIZE && (
                  <div className="table-pagination-row">
                    <button type="button" className="ghost small" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                      Previous
                    </button>
                    <p className="pagination-label">Page {currentPage} of {totalPages}</p>
                    <button type="button" className="ghost small" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {showRegister && <RegisterPatientModal onClose={() => setShowRegister(false)} onSubmit={handleRegister} />}
        </main>
      </div>
    </ProtectedRoute>
  );
}
