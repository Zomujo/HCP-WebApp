"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { pharmacyPatientApi } from '../../../lib/api';
import type { Patient } from '../../../lib/api';

interface VitalReading {
  id?: string;
  vitalType?: string;
  vitalName?: string;
  value?: string | number;
  unit?: string;
  severity?: string;
}

export default function PharmacyPatientDetailPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;

    const loadPatient = async () => {
      try {
        setIsLoading(true);
        setError('');
        const [patientData, latestVitals] = await Promise.all([
          pharmacyPatientApi.getPatientById(params.id),
          pharmacyPatientApi.getLatestVitals(params.id),
        ]);
        setPatient(patientData);
        setVitals(latestVitals);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patient details');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatient();
  }, [params.id]);

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <Link href="/pharmacy/patients" className="text-link">Back to patients</Link>
              <h1 className="hcp-page-title" style={{ marginTop: 8 }}>
                {patient?.name || 'Patient details'}
              </h1>
              <p className="subtitle">Pharmacy patient overview and latest recorded vitals.</p>
            </div>
          </div>

          {isLoading && <p className="text-muted">Loading patient details...</p>}
          {error && <div className="error-banner" role="alert">{error}</div>}

          {!isLoading && patient && (
            <>
              <section className="panel hcp-panel patient-overview-grid">
                <div>
                  <p className="panel-title">Patient information</p>
                  <div className="patient-kv-grid">
                    <div><p className="block-label">Patient code</p><p>{patient.patientCode || 'N/A'}</p></div>
                    <div><p className="block-label">Age</p><p>{patient.age || 'N/A'}</p></div>
                    <div><p className="block-label">Gender</p><p>{patient.gender || 'N/A'}</p></div>
                    <div><p className="block-label">Condition</p><p>{patient.chronicConditions?.join(', ') || 'N/A'}</p></div>
                    <div><p className="block-label">Adherence</p><p>{patient.adherence || patient.status || 'N/A'}</p></div>
                    <div><p className="block-label">Facility</p><p>{patient.facility || 'N/A'}</p></div>
                    <div><p className="block-label">Height</p><p>{patient.height ? `${patient.height} cm` : 'N/A'}</p></div>
                    <div><p className="block-label">Weight</p><p>{patient.weight ? `${patient.weight} kg` : 'N/A'}</p></div>
                    <div><p className="block-label">BMI</p><p>{patient.bmi ?? 'N/A'}</p></div>
                  </div>
                </div>
              </section>

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row">
                  <div>
                    <p className="panel-title">Latest vitals</p>
                    <p className="text-muted">Most recent readings available for this patient.</p>
                  </div>
                </div>
                {vitals.length > 0 ? (
                  <div className="metric-summary-grid">
                    {vitals.map((vital, index) => (
                      <div className="metric-summary-card" key={vital.id || `${vital.vitalType}-${index}`}>
                        <p className="block-label">{vital.vitalName || vital.vitalType || 'Vital sign'}</p>
                        <p>{vital.value ?? 'N/A'} {vital.unit || ''}</p>
                        <span className="text-muted">{vital.severity || 'No severity recorded'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No vital readings recorded yet.</p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
