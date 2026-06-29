"use client";

import { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { patientDetail } from '../../lib/dummy';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];

export default function PatientDetailsPage() {
  const [activeTab, setActiveTab] = useState<TabName>('Overview');

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content hcp-page">
        <section className="patient-head-figma">
          <div className="table-avatar patient-head-avatar">{patientDetail.initials}</div>
          <div>
            <h1 className="patient-head-title">{patientDetail.name}</h1>
            <p className="text-muted" style={{ margin: '4px 0 0' }}>{patientDetail.age} • {patientDetail.condition} • Patient since {patientDetail.joined}</p>
            <div className="patient-chip-row">
              <span className="badge badge-critical">3 critical readings</span>
              <span className="badge badge-caution">Adherence 64%</span>
              <span className="badge" style={{ background: '#f3efe8', color: '#525a67' }}>Assigned to you</span>
            </div>
          </div>
        </section>

        <nav className="patient-tab-nav" aria-label="Patient tabs">
          {tabs.map((tab) => (
            <button key={tab} type="button" className={`patient-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === 'Overview' && (
          <section className="patient-overview-grid">
            <div className="panel hcp-panel">
              <p className="panel-title">Patient details</p>
              <div className="patient-kv-grid">
                <div>
                  <p className="block-label">Full name</p>
                  <p>{patientDetail.name}</p>
                </div>
                <div>
                  <p className="block-label">Age</p>
                  <p>{patientDetail.age}</p>
                </div>
                <div>
                  <p className="block-label">Ghana Card</p>
                  <p>{patientDetail.ghanaCard}</p>
                </div>
                <div>
                  <p className="block-label">NHIS</p>
                  <p>{patientDetail.nhis}</p>
                </div>
                <div>
                  <p className="block-label">Conditions</p>
                  <p>{patientDetail.condition}</p>
                </div>
                <div>
                  <p className="block-label">Registered</p>
                  <p>14 Jan 2025</p>
                </div>
                <div>
                  <p className="block-label">Facility</p>
                  <p>{patientDetail.facility}</p>
                </div>
              </div>
            </div>

            <div className="panel hcp-panel">
              <p className="panel-title">Latest vitals</p>
              <div className="latest-vitals-box">
                <p className="block-label" style={{ color: '#c14d4d' }}>CRITICAL</p>
                <p className="latest-vitals-value">{patientDetail.vitals.systolic} / {patientDetail.vitals.diastolic}</p>
                <p className="text-muted">{patientDetail.vitals.note}</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Readings' && (
          <section className="panel hcp-panel">
            <div className="readings-chart-box">
              <svg viewBox="0 0 480 190" preserveAspectRatio="none" className="readings-chart-svg" aria-hidden="true">
                <polyline fill="none" stroke="#f0aa62" strokeWidth="3" points="0,150 45,130 90,140 135,70 180,110 225,120 270,112 315,145 360,55 405,90 450,82 480,90" />
              </svg>
            </div>

            <div className="reading-card">
              <p><strong>BP {patientDetail.vitals.systolic} / {patientDetail.vitals.diastolic}</strong> <span className="status-pill status-critical">Critical</span></p>
              <p className="text-muted">Today 07:42 • AI check-in</p>
              <div className="reading-note-row">
                <span className="filter-pill">Your reading looks good, keep it up.</span>
                <span className="filter-pill">This reading needs monitoring, please check again tomorrow.</span>
                <span className="filter-pill">This reading is concerning, please visit the facility as soon as possible.</span>
              </div>
            </div>

            {patientDetail.readings.slice(1).map((item) => (
              <div key={item.time} className="reading-mini-card">
                <p><strong>BP {item.value}</strong></p>
                <p className="text-muted">{item.time}</p>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'Medication' && (
          <section className="patient-overview-grid">
            <div className="panel hcp-panel">
              <div className="panel-headline-row">
                <p className="panel-title">30-day adherence</p>
                <p className="panel-title" style={{ color: '#f0a950' }}>64% overall</p>
              </div>
              <div className="adherence-grid">
                {Array.from({ length: 30 }).map((_, index) => (
                  <span key={index} className={`adherence-cell-dot ${(index + 1) % 6 === 0 || index === 3 || index === 12 ? 'missed' : ''}`} />
                ))}
              </div>
              <label style={{ marginTop: 16, display: 'block' }}>
                <span className="onboarding-field-label">Note to patient about adherence</span>
                <textarea rows={3} placeholder="Write a short, warm note in plain language..." />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="primary small">Send & notify patient</button>
              </div>
            </div>

            <div className="panel hcp-panel">
              <p className="panel-title">Prescription</p>
              {patientDetail.medication.map((item) => (
                <div key={item.name} className="prescription-card">
                  <p style={{ margin: 0, fontWeight: 700 }}>{item.name}</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>{item.dose}</p>
                  <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>Adherence {item.adherence}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'Appointments' && (
          <section className="panel hcp-panel">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="primary small">+ New Appointment</button>
            </div>

            <p className="block-label" style={{ marginBottom: 8 }}>Upcoming</p>
            <div className="list-card">
              <div className="appointment-row">
                <div>
                  <p className="appointment-title">Wed 3 Jun • 09:00 • Clinic</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>BP review — bring your diary.</p>
                </div>
                <button className="text-link">Cancel</button>
              </div>
              <div className="appointment-row">
                <div>
                  <p className="appointment-title">Mon 8 Jun • 14:00 • Phone</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>Adherence check-in call.</p>
                </div>
                <button className="text-link">Cancel</button>
              </div>
            </div>

            <p className="block-label" style={{ margin: '16px 0 8px' }}>Past</p>
            <div className="appointment-row">
              <div>
                <p className="appointment-title">Mon 13 May • 09:30 • Clinic</p>
                <p className="text-muted" style={{ margin: '4px 0 0' }}>Medication review.</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Chat' && (
          <section className="panel hcp-panel patient-chat-box">
            <div className="message-list" style={{ padding: 8 }}>
              {patientDetail.messages.map((message, index) => (
                <div key={index} className={`message-bubble ${message.type === 'to' ? 'message-to' : 'message-from'}`}>
                  {message.text}
                  <div className="message-time">{message.time}</div>
                </div>
              ))}
            </div>

            <div className="chat-input-row" style={{ marginTop: 0 }}>
              <input type="text" placeholder="Write a short, warm reply..." />
              <button className="primary small">➤</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
