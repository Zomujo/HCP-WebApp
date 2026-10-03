"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { pharmacyPatientApi } from '../../lib/api';
import { formatConditions } from '../../lib/format';
import type { Patient } from '../../lib/api';

export default function PharmacyPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setIsLoading(true);
        setError('');
        const data = await pharmacyPatientApi.getPatients(1, 100);
        setPatients(data);
      } catch (err) {
        console.error('Failed to load pharmacy patients:', err);
        setError(err instanceof Error ? err.message : 'Failed to load patients');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`).toLowerCase();
      return fullName.includes(query) ||
        (patient.patientCode || '').toLowerCase().includes(query) ||
        (patient.ghanaCard || '').toLowerCase().includes(query);
    });
  }, [patients, searchQuery]);

  const getInitials = (name?: string) => {
    const initials = (name || 'Unknown')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('');
    return initials.toUpperCase();
  };

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patients</h1>
              <p className="subtitle">Review patient condition and medication adherence.</p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <section className="panel hcp-panel">
            <div className="panel-headline-row">
              <div>
                <p className="panel-title">Patients overview</p>
                <p className="panel-subtitle">{isLoading ? 'Loading...' : `${filteredPatients.length} patients available`}</p>
              </div>
            </div>

            <div className="search-row">
              <input
                type="search"
                className="search-input"
                placeholder="Search by name or Ghana Card"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="table-wrap stack-on-mobile">

              <table className="table hcp-table pharmacy-patients-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Patient Code</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Condition</th>
                    <th>Adherence</th>
                    <th>Facility</th>
                    <th>BMI</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        Loading patients...
                      </td>
                    </tr>
                  ) : filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td className="cell-primary">
                        <Link href={`/pharmacy/patients/${patient.id}`} className="table-name-cell">
                          <span className="table-avatar">{getInitials(patient.name)}</span>
                          {patient.name || `${patient.firstName} ${patient.lastName}`}
                        </Link>
                      </td>
                      <td data-label="Patient code">{patient.patientCode || 'N/A'}</td>
                      <td data-label="Age">{patient.age}</td>
                      <td data-label="Gender">{patient.gender || 'N/A'}</td>
                      <td data-label="Condition">{formatConditions(patient.chronicConditions)}</td>
                      <td data-label="Adherence">
                        <span className={`status-pill status-${(patient.status || 'unknown').toLowerCase()}`}>
                          {patient.adherence || patient.status || 'N/A'}
                        </span>
                      </td>
                      <td data-label="Facility">{patient.facility || 'N/A'}</td>
                      <td data-label="BMI">{patient.bmi ?? 'N/A'}</td>
                    </tr>
                  ))) : (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        No patients found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
