"use client";

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../lib/AuthContext';
import { hcpPatientApi } from '../lib/api';
import type { Appointment } from '../lib/api';

function AppointmentsContent() {
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId') || '';
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);

  // Load appointments and patients on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError('');

        const facilityId = user?.facilityId || user?.facility?.id;
        if (!facilityId) {
          setPatients([]);
          setAppointments([]);
          return;
        }

        const patientData = await hcpPatientApi.getPatientsWithOptions({
          page: 1,
          pageSize: 50,
          facilityId,
        });
        setPatients(patientData);

        const appointmentLists = await Promise.all(
          patientData.slice(0, 20).map(async (patient) => {
            try {
              const appts = await hcpPatientApi.getPatientAppointments(
                patient.id,
                timeFilter === 'all' ? undefined : timeFilter,
                undefined,
                1,
                50
              );

              return appts.map((appt) => ({
                ...appt,
                patientId: patient.id,
                patientName: `${patient.firstName} ${patient.lastName}`.trim(),
              }));
            } catch {
              return [];
            }
          })
        );

        const nextAppointments = appointmentLists.flat().sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
        setAppointments(nextAppointments);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load appointments');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.facilityId, user?.facility?.id, timeFilter]);

  useEffect(() => {
    if (preselectedPatientId && !isLoading && patients.some((patient) => patient.id === preselectedPatientId)) {
      setShowModal(true);
    }
  }, [isLoading, patients, preselectedPatientId]);

  const filteredAppointments = appointments.filter((appt) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      appt.patientName?.toLowerCase().includes(query) ||
      appt.title?.toLowerCase().includes(query) ||
      false
    );
  });

  const handleCancelAppointment = async (appointment: Appointment) => {
    if (!appointment.patientId || !appointment.id) return;
    setError('');

    try {
      await hcpPatientApi.cancelAppointment(appointment.patientId, appointment.id, 'Cancelled by clinician');
      setAppointments((prev) => prev.filter((appt) => appt.id !== appointment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel appointment');
    }
  };

  const handleCreateAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const data = new FormData(event.currentTarget);
      const patientId = data.get('patientId') as string;
      const date = data.get('date') as string;
      const time = data.get('time') as string;
      const title = (data.get('title') as string) || 'Follow-up check';
      const notes = data.get('notes') as string;

      if (!patientId || !date || !time) {
        setError('Please fill in all required fields');
        return;
      }

      // Combine date and time into ISO format
      const appointmentDate = new Date(`${date}T${time}`).toISOString();

      await hcpPatientApi.createAppointment(patientId, {
        title,
        description: notes,
        appointmentDate,
      });

      // Reload appointments for the selected patient and merge
      const patient = patients.find((p) => p.id === patientId);
      const patientAppts = await hcpPatientApi.getPatientAppointments(patientId, 'upcoming');
      const mapped = patientAppts.map((appt) => ({
        ...appt,
        patientId,
        patientName: patient
          ? `${patient.firstName} ${patient.lastName}`.trim()
          : appt.patientName,
      }));

      setAppointments((prev) => [
        ...mapped,
        ...prev.filter((a) => a.patientId !== patientId),
      ]);

      setShowModal(false);
      if (event.currentTarget) {
        event.currentTarget.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Appointments</h1>
              <p className="subtitle">Set and review appointments for your patients.</p>
            </div>
            <button className="primary small" onClick={() => setShowModal(true)}>+ Set Appointment</button>
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
              Loading appointments...
            </div>
          ) : (
            <div className="appointments-layout">
              <div className="panel hcp-panel">
                <div className="search-row" style={{ marginBottom: 14 }}>
                  <input 
                    type="text" 
                    placeholder="Search by name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-row" style={{ display: 'flex', gap: '12px', marginBottom: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem' }}>
                    <span>Time</span>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value as 'all' | 'upcoming' | 'past')}
                      style={{ minWidth: 120 }}
                    >
                      <option value="all">All</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past</option>
                    </select>
                  </label>

                </div>

                <div className="list-card">
                  {filteredAppointments.length > 0 ? (
                    filteredAppointments.map((appt) => (
                      <div key={appt.id} className="appointment-row">
                        <div>
                          <p className="appointment-title">{appt.title || appt.patientName}</p>
                          <p className="text-muted" style={{ margin: '4px 0 0' }}>
                            {new Date(appt.dateTime).toLocaleString()} • {appt.patientName}
                          </p>
                          {appt.description && (
                            <p className="text-muted" style={{ margin: '4px 0 0' }}>Note: {appt.description}</p>
                          )}
                        </div>
                        <button className="text-link" onClick={() => handleCancelAppointment(appt)}>Cancel</button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      No appointments found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showModal && (
            <div className="modal-backdrop" onClick={() => setShowModal(false)}>
              <aside className="panel hcp-panel appointment-modal-preview appointment-modal-overlay" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Set an Appointment">
                <div className="modal-head-row">
                  <p className="panel-title" style={{ margin: 0 }}>Set an Appointment</p>
                  <button type="button" className="modal-close" aria-label="Close modal" onClick={() => setShowModal(false)}>
                    ×
                  </button>
                </div>
                <form onSubmit={handleCreateAppointment}>
                  <label>
                    <span className="onboarding-field-label">Patient</span>
                    <select name="patientId" required disabled={isSubmitting} defaultValue={preselectedPatientId}>
                      <option value="">Search patient by name</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="onboarding-grid-two">
                    <label>
                      <span className="onboarding-field-label">Date</span>
                      <input name="date" type="date" required placeholder="dd/mm/yyyy" disabled={isSubmitting} />
                    </label>
                    <label>
                      <span className="onboarding-field-label">Time</span>
                      <input name="time" type="time" required placeholder="--:--" disabled={isSubmitting} />
                    </label>
                  </div>
                  <label>
                    <span className="onboarding-field-label">Notes for Patient (optional)</span>
                    <textarea name="notes" placeholder="e.g Don&apos;t eat in the morning before you come." disabled={isSubmitting} />
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="ghost small" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancel</button>
                    <button type="submit" className="primary small" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Set Appointment'}
                    </button>
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

export default function AppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <AppointmentsContent />
    </Suspense>
  );
}
