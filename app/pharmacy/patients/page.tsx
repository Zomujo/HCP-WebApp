"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { addVital, getAllPatients, getVitalsForPatient, PatientRecord } from '../../lib/patientStore';

export default function PharmacyPatientsPage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setPatients(getAllPatients());
  }, []);

  const patientsWithVitalsState = useMemo(() => {
    return patients.map((patient) => {
      const vitals = getVitalsForPatient(patient.id);
      return {
        ...patient,
        hasVitals: vitals.length > 0,
      };
    });
  }, [patients]);

  const openVitalsModalIfNeeded = (patient: PatientRecord & { hasVitals: boolean }) => {
    if (patient.hasVitals) {
      return;
    }

    setSelectedPatient(patient);
    setShowVitalsModal(true);
  };

  const closeModal = () => {
    setShowVitalsModal(false);
    setSelectedPatient(null);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setTemperature('');
    setWeightKg('');
    setNote('');
  };

  const handleSaveVitals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPatient) {
      return;
    }

    const parsedSystolic = Number(systolic);
    const parsedDiastolic = Number(diastolic);

    if (Number.isNaN(parsedSystolic) || Number.isNaN(parsedDiastolic)) {
      alert('Please enter valid systolic and diastolic values.');
      return;
    }

    addVital(selectedPatient.id, {
      systolic: parsedSystolic,
      diastolic: parsedDiastolic,
      pulse: pulse ? Number(pulse) : undefined,
      temperature: temperature ? Number(temperature) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      note,
    });

    setPatients(getAllPatients());
    closeModal();
  };

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patients</h1>
              <p className="subtitle">Click a patient to capture vitals when they are missing.</p>
            </div>
          </div>

          <section className="panel hcp-panel">
            <div className="panel-headline-row" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-title">Patient Vitals Intake</p>
                <p className="text-muted">{patientsWithVitalsState.length} patients available</p>
              </div>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age</th>
                  <th>Condition</th>
                  <th>Last check-in</th>
                  <th>Vitals</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patientsWithVitalsState.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => openVitalsModalIfNeeded(patient)}
                    style={{ cursor: patient.hasVitals ? 'default' : 'pointer' }}
                  >
                    <td>
                      <div className="table-name-cell">
                        <span className="table-avatar">{patient.initials}</span>
                        {patient.name}
                      </div>
                    </td>
                    <td>{patient.age}</td>
                    <td>{patient.condition}</td>
                    <td>{patient.lastCheckIn}</td>
                    <td>
                      <span className={`status-pill ${patient.hasVitals ? 'status-stable' : 'status-silent'}`}>
                        {patient.hasVitals ? 'Entered' : 'Not entered'}
                      </span>
                    </td>
                    <td>
                      {!patient.hasVitals ? (
                        <button
                          type="button"
                          className="text-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            openVitalsModalIfNeeded(patient);
                          }}
                        >
                          Enter vitals
                        </button>
                      ) : (
                        <span className="text-muted">Already entered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {showVitalsModal && selectedPatient && (
            <div className="modal-backdrop" onClick={closeModal}>
              <aside
                className="panel hcp-panel appointment-modal-preview appointment-modal-overlay"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Enter patient vitals"
              >
                <div className="modal-head-row">
                  <p className="panel-title" style={{ margin: 0 }}>Enter vitals for {selectedPatient.name}</p>
                  <button type="button" className="modal-close" aria-label="Close modal" onClick={closeModal}>
                    ×
                  </button>
                </div>

                <form onSubmit={handleSaveVitals}>
                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Systolic (mmHg)</span>
                      <input type="number" min={50} required value={systolic} onChange={(event) => setSystolic(event.target.value)} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Diastolic (mmHg)</span>
                      <input type="number" min={30} required value={diastolic} onChange={(event) => setDiastolic(event.target.value)} />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Pulse (optional)</span>
                      <input type="number" min={20} value={pulse} onChange={(event) => setPulse(event.target.value)} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Temperature (optional)</span>
                      <input type="number" min={30} step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
                    </label>
                  </div>

                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Weight kg (optional)</span>
                      <input type="number" min={1} step="0.1" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Note</span>
                      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
                    </label>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="ghost small" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="primary small">Save vitals</button>
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
