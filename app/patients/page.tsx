"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { getAllPatients, registerPatient } from '../lib/patientStore';

export default function PatientsPage() {
  const [patients, setPatients] = useState(getAllPatients());
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    setPatients(getAllPatients());
  }, []);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      return (
        patient.name.toLowerCase().includes(query) ||
        patient.id.toLowerCase().includes(query) ||
        (patient.ghanaCard || '').toLowerCase().includes(query)
      );
    });
  }, [patients, searchQuery]);

  const handleRegisterPatient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get('fullName') || '').trim();
    const age = Number(data.get('age'));
    const condition = String(data.get('condition') || '').trim();

    if (!fullName || Number.isNaN(age) || age <= 0 || !condition) {
      alert('Please provide a valid full name, age, and condition.');
      return;
    }

    registerPatient({
      fullName,
      age,
      condition,
      ghanaCard: String(data.get('ghanaCard') || ''),
      nhis: String(data.get('nhis') || ''),
      facility: String(data.get('facility') || ''),
    });

    setPatients(getAllPatients());
    setShowRegisterModal(false);
    event.currentTarget.reset();
  };

  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patients</h1>
              <p className="subtitle">{patients.length} patients in your care.</p>
            </div>
            <button className="primary small" onClick={() => setShowRegisterModal(true)}>+ Register patient</button>
          </div>

          <div className="panel hcp-panel">
            <div className="search-row" style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search by name, ID, Ghana Card"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <div className="filter-row">
                <span className="filter-pill active">All</span>
                <span className="filter-pill">Hypertension</span>
                <span className="filter-pill">Diabetes</span>
                <span className="filter-pill">Both</span>
                <span className="filter-pill">Critical</span>
                <span className="filter-pill">Silent</span>
                <span className="filter-pill">Stable</span>
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
                {filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="table-name-cell">
                        <span className="table-avatar">{patient.initials}</span>
                        {patient.name}
                      </div>
                    </td>
                    <td>{patient.age}</td>
                    <td>{patient.condition}</td>
                    <td>{patient.lastCheckIn}</td>
                    <td className="adherence-cell">{patient.adherence}</td>
                    <td>
                      <span className={`status-pill status-${patient.status.toLowerCase()}`}>
                        {patient.status}
                      </span>
                    </td>
                    <td className="row-arrow">
                      <Link href={`/patients/${patient.id}`} aria-label={`Open ${patient.name} details`}>
                        &gt;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
