"use client";

import { useState } from 'react';
import { appointments } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';

export default function AppointmentsPage() {
  const [showModal, setShowModal] = useState(false);

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

        <div className="appointments-layout">
          <div className="panel hcp-panel">
            <div className="search-row" style={{ marginBottom: 14 }}>
              <input type="text" placeholder="Search by name" />
            </div>

            <div className="list-card">
              {appointments.map((appt) => (
                <div key={appt.id} className="appointment-row">
                  <div>
                    <p className="appointment-title">{appt.patient}</p>
                    <p className="text-muted" style={{ margin: '4px 0 0' }}>{appt.time}</p>
                    <p className="text-muted" style={{ margin: '4px 0 0' }}>Note: {appt.note}</p>
                  </div>
                  <button className="text-link">Cancel</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showModal && (
          <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <aside className="panel hcp-panel appointment-modal-preview appointment-modal-overlay" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Set an Appointment">
              <div className="modal-head-row">
                <p className="panel-title" style={{ margin: 0 }}>Set an Appointment</p>
                <button type="button" className="modal-close" aria-label="Close modal" onClick={() => setShowModal(false)}>
                  ×
                </button>
              </div>
              <label>
                <span className="onboarding-field-label">Patient</span>
                <input placeholder="Search patient by name" />
              </label>
              <div className="onboarding-grid-two">
                <label>
                  <span className="onboarding-field-label">Date</span>
                  <input placeholder="mm/dd/yyyy" />
                </label>
                <label>
                  <span className="onboarding-field-label">Time</span>
                  <input placeholder="--:--" />
                </label>
              </div>
              <label>
                <span className="onboarding-field-label">Notes for Patient</span>
                <input placeholder="Don't eat in the morning before you come." />
              </label>

              <div className="modal-actions">
                <button type="button" className="ghost small" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="button" className="primary small" onClick={() => setShowModal(false)}>Save Appointment</button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
    </ProtectedRoute>
  );
}
