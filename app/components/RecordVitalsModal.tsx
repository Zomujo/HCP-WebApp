"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { VitalEntry, VitalReadingInput } from '../lib/api';
import {
  SEVERITY_LABEL,
  VITAL_DEFINITIONS,
  VitalType,
  classifyVital,
  isVitalType,
  validateVitalValue,
} from '../lib/vitals';

const NOTES_LIMIT = 500;

type VitalValues = Record<VitalType, string>;

const EMPTY_VALUES = Object.fromEntries(VITAL_DEFINITIONS.map((definition) => [definition.type, ''])) as VitalValues;

// datetime-local needs local time without seconds or zone.
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export interface RecordVitalsSubmission {
  recordedAt: string;
  notes?: string;
  vitals: VitalReadingInput[];
}

interface RecordVitalsModalProps {
  patientName: string;
  /** When provided the form edits this entry instead of creating a new one. */
  entry?: VitalEntry | null;
  onClose: () => void;
  onSubmit: (submission: RecordVitalsSubmission) => Promise<void>;
}

export function RecordVitalsModal({ patientName, entry, onClose, onSubmit }: RecordVitalsModalProps) {
  const isEditing = Boolean(entry);
  const [values, setValues] = useState<VitalValues>(() => {
    if (!entry) return { ...EMPTY_VALUES };
    const next = { ...EMPTY_VALUES };
    for (const vital of entry.vitals) {
      if (isVitalType(vital.vitalType)) next[vital.vitalType] = vital.value;
    }
    return next;
  });
  const [recordedAt, setRecordedAt] = useState(() =>
    toLocalInputValue(entry?.recordedAt ? new Date(entry.recordedAt) : new Date())
  );
  const [notes, setNotes] = useState(entry?.notes || '');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<VitalType, string>> = {};
    for (const definition of VITAL_DEFINITIONS) {
      const error = validateVitalValue(definition.type, values[definition.type]);
      if (error) errors[definition.type] = error;
    }
    return errors;
  }, [values]);

  const filledCount = VITAL_DEFINITIONS.filter((definition) => values[definition.type].trim()).length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setFormError('');

    if (filledCount === 0) {
      setFormError('Enter at least one reading.');
      return;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setFormError('Check the highlighted readings.');
      return;
    }

    const recordedDate = new Date(recordedAt);
    if (Number.isNaN(recordedDate.getTime())) {
      setFormError('Choose when these readings were taken.');
      return;
    }
    if (recordedDate.getTime() > Date.now() + 60_000) {
      setFormError('The reading time cannot be in the future.');
      return;
    }

    const vitals: VitalReadingInput[] = VITAL_DEFINITIONS.filter((definition) => values[definition.type].trim()).map(
      (definition) => {
        const value = values[definition.type].trim().replace(/\s+/g, '');
        return {
          vitalType: definition.type,
          value,
          unit: definition.unit,
          severity: classifyVital(definition.type, value),
        };
      }
    );

    try {
      setIsSaving(true);
      await onSubmit({ recordedAt: recordedDate.toISOString(), notes: notes.trim() || undefined, vitals });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save these readings.');
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSaving && onClose()}>
      <form
        className="vitals-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-vitals-heading"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="readings-modal-header">
          <div>
            <p className="eyebrow">{isEditing ? 'Edit entry' : 'New entry'}</p>
            <h3 id="record-vitals-heading">{isEditing ? 'Edit vitals' : 'Record vitals'}</h3>
            <p className="readings-description">{patientName} · fill in only the readings you took.</p>
          </div>
          <button type="button" className="readings-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
            ×
          </button>
        </div>

        <label className="vitals-recorded-at">
          <span className="onboarding-field-label">Taken at</span>
          <input
            type="datetime-local"
            value={recordedAt}
            max={toLocalInputValue(new Date())}
            onChange={(event) => setRecordedAt(event.target.value)}
            disabled={isSaving}
            required
          />
        </label>

        <div className="vital-input-grid">
          {VITAL_DEFINITIONS.map((definition, index) => {
            const value = values[definition.type];
            const error = fieldErrors[definition.type];
            const showError = Boolean(error) && (submitAttempted || value.trim().length >= 2);
            const severity = value.trim() && !error ? classifyVital(definition.type, value) : null;
            const inputId = `vital-${definition.type}`;

            return (
              <div key={definition.type} className={`vital-input-field ${showError ? 'has-error' : ''}`}>
                <div className="vital-input-label-row">
                  <label htmlFor={inputId} className="onboarding-field-label">{definition.label}</label>
                  {severity && <span className={`rd-pill vital-tone-${severity}`}>{SEVERITY_LABEL[severity]}</span>}
                </div>
                <div className="input-with-unit">
                  <input
                    id={inputId}
                    ref={index === 0 ? firstInputRef : undefined}
                    inputMode={definition.type === 'bloodPressure' ? 'text' : 'decimal'}
                    placeholder={definition.placeholder}
                    value={value}
                    onChange={(event) => setValues((previous) => ({ ...previous, [definition.type]: event.target.value }))}
                    disabled={isSaving}
                    aria-invalid={showError}
                    aria-describedby={`${inputId}-hint`}
                  />
                  <span className="input-unit" aria-hidden>{definition.unit}</span>
                </div>
                <p id={`${inputId}-hint`} className={showError ? 'field-error' : 'field-hint'}>
                  {showError ? error : definition.hint}
                </p>
              </div>
            );
          })}
        </div>

        <label className="readings-notes-field">
          <div className="readings-field-heading">
            <span className="onboarding-field-label">Notes (optional)</span>
            <span className="readings-character-count">{notes.length}/{NOTES_LIMIT}</span>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, NOTES_LIMIT))}
            placeholder="e.g. Taken after a 10-minute rest; patient reports headaches."
            rows={3}
            disabled={isSaving}
          />
        </label>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <div className="readings-entry-actions">
          <button type="button" className="ghost small" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="primary small" disabled={isSaving}>
            {isSaving ? 'Saving…' : isEditing ? 'Save changes' : `Save ${filledCount > 1 ? `${filledCount} readings` : 'reading'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
