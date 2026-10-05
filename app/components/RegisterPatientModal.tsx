"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { CreatePatientInput } from '../lib/api';
import { normalizePhoneNumber } from '../lib/api';

const CONDITIONS = [
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'diabetes', label: 'Diabetes' },
];

function ageFromDateOfBirth(value: string): number | null {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

interface RegisterPatientModalProps {
  onClose: () => void;
  onSubmit: (input: CreatePatientInput) => Promise<void>;
}

export function RegisterPatientModal({ onClose, onSubmit }: RegisterPatientModalProps) {
  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    dateOfBirth: '',
    gender: '',
    phoneNumber: '',
    ghanaCardNumber: '',
    nhisNumber: '',
  });
  const [conditions, setConditions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const age = form.dateOfBirth ? ageFromDateOfBirth(form.dateOfBirth) : null;
  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const toggleCondition = (value: string) =>
    setConditions((previous) => (previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!event.currentTarget.reportValidity()) return;
    if (age === null || age < 0 || age > 120) {
      setError('Enter a valid date of birth.');
      return;
    }
    if (conditions.length === 0) {
      setError('Select at least one chronic condition.');
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit({
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        dateOfBirth: form.dateOfBirth,
        age,
        gender: form.gender as CreatePatientInput['gender'],
        phoneNumber: normalizePhoneNumber(form.phoneNumber.replace(/\s+/g, '')),
        ghanaCardNumber: form.ghanaCardNumber.trim().toUpperCase(),
        nhisNumber: form.nhisNumber.trim(),
        chronicConditions: conditions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register this patient.');
      setIsSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="modal-backdrop" onClick={() => !isSaving && onClose()}>
      <form
        className="appointment-modal-overlay register-patient-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-patient-heading"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-head-row">
          <div>
            <p className="panel-title" id="register-patient-heading">Register patient</p>
            <p className="modal-subtitle">Add a patient to your pharmacy to start tracking their vitals.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} disabled={isSaving}>×</button>
        </div>

        <p className="form-section-label">Personal details</p>
        <div className="onboarding-grid-two">
          <label>
            <span className="onboarding-field-label">First name</span>
            <input ref={firstInputRef} value={form.firstname} onChange={update('firstname')} required autoComplete="off" disabled={isSaving} />
          </label>
          <label>
            <span className="onboarding-field-label">Last name</span>
            <input value={form.lastname} onChange={update('lastname')} required autoComplete="off" disabled={isSaving} />
          </label>
        </div>

        <div className="onboarding-grid-two">
          <label>
            <span className="onboarding-field-label">
              Date of birth{age !== null && age >= 0 ? <span className="label-aside"> · {age} yrs</span> : null}
            </span>
            <input type="date" value={form.dateOfBirth} max={today} onChange={update('dateOfBirth')} required disabled={isSaving} />
          </label>
          <label>
            <span className="onboarding-field-label">Gender</span>
            <select value={form.gender} onChange={update('gender')} required disabled={isSaving}>
              <option value="" disabled>Select gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label>
          <span className="onboarding-field-label">Phone number</span>
          <input
            type="tel"
            inputMode="tel"
            value={form.phoneNumber}
            onChange={update('phoneNumber')}
            placeholder="+233 55 123 4567 or 055 123 4567"
            pattern="(\+?233|0)[0-9\s]{9,12}"
            title="Use a Ghana number, e.g. 0551234567 or +233551234567"
            required
            disabled={isSaving}
          />
        </label>

        <p className="form-section-label">Identification</p>
        <div className="onboarding-grid-two">
          <label>
            <span className="onboarding-field-label">Ghana Card number</span>
            <input
              value={form.ghanaCardNumber}
              onChange={update('ghanaCardNumber')}
              placeholder="GHA-123456789-0"
              pattern="[Gg][Hh][Aa]-?\d{9}-?\d"
              title="Format: GHA-123456789-0"
              required
              disabled={isSaving}
            />
          </label>
          <label>
            <span className="onboarding-field-label">NHIS number</span>
            <input value={form.nhisNumber} onChange={update('nhisNumber')} placeholder="NHIS number" required disabled={isSaving} />
          </label>
        </div>

        <fieldset className="condition-picker" disabled={isSaving}>
          <legend className="onboarding-field-label">Chronic conditions</legend>
          <div className="condition-chips">
            {CONDITIONS.map((condition) => {
              const checked = conditions.includes(condition.value);
              return (
                <label key={condition.value} className={`condition-chip ${checked ? 'checked' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCondition(condition.value)} />
                  <span className="condition-check" aria-hidden>{checked ? '✓' : ''}</span>
                  {condition.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="ghost small" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="primary small" disabled={isSaving}>
            {isSaving ? 'Registering…' : 'Register patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
