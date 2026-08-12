"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { facilityApi, normalizePhoneNumber } from '../lib/api';
import { ROLE_CONFIG } from '../lib/config';

interface Facility {
  id: string;
  name: string;
}

const stepLabels = ['Identity', 'Facility', 'Review'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, onboard, isLoading } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  // Load facilities on mount
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        const data = await facilityApi.getFacilities();
        setFacilities(data);
      } catch (err) {
        console.error('Failed to load facilities:', err);
        setError('Failed to load facilities');
      }
    };
    
    loadFacilities();
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  const handleSubmit = async () => {
    if (activeStep < 2) {
      // Validate current step
      if (activeStep === 0) {
        if (!firstName.trim() || !lastName.trim() || !phone.trim() || !registrationNumber.trim()) {
          setError('Please fill in all required fields');
          return;
        }
      } else if (activeStep === 1) {
        if (!selectedFacilityId) {
          setError('Please select a facility');
          return;
        }
      }
      
      setError('');
      setActiveStep(activeStep + 1);
    } else {
      // Submit onboarding
      setIsSubmitting(true);
      setError('');

      try {
        const selectedFacility = facilities.find((facility) => facility.id === selectedFacilityId);

        if (!user?.personnelId) {
          throw new Error('Missing personnel ID for onboarding. Please sign in again.');
        }

        await onboard({
          personnelId: user.personnelId,
          role: user.role,
          firstname: firstName.trim(),
          lastname: lastName.trim(),
          phoneNumber: normalizePhoneNumber(phone),
          personnelIdNumber: registrationNumber.trim(),
          facilityId: selectedFacilityId,
          facilityName: selectedFacility?.name,
        });

        router.push(ROLE_CONFIG[user.role].defaultRoute);
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Onboarding failed. Please try again.';
        if (rawMessage.toLowerCase().includes('username') && rawMessage.toLowerCase().includes('already in use')) {
          setError('That full name is already taken on the server. Please go back and slightly change your first or last name (for example add an initial) and submit again.');
        } else {
          setError(rawMessage);
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderStepBody = () => {
    if (activeStep === 0) {
      return (
        <>
          <p className="onboarding-section-title">Personal Information</p>
          <div className="onboarding-grid-two">
            <label>
              <span className="onboarding-field-label">First Name</span>
              <input 
                placeholder="e.g Kelvin"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
            <label>
              <span className="onboarding-field-label">Last Name</span>
              <input 
                placeholder="e.g Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <label>
            <span className="onboarding-field-label">Phone Number</span>
            <input 
              placeholder="+233501234567 or 0551234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              inputMode="tel"
            />
          </label>

          <p className="onboarding-section-title" style={{ marginTop: 8 }}>Professional Information</p>
          <label>
            <span className="onboarding-field-label">Nurse Registration Number</span>
            <input 
              placeholder="RN/12345/2024"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </>
      );
    }

    if (activeStep === 1) {
      return (
        <>
          <p className="onboarding-note">
            Please specify the primary health facility where you currently practice. This helps us coordinate logistics and patient routing.
          </p>
          <label>
            <span className="onboarding-field-label">Select Facility</span>
            <select 
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              disabled={isSubmitting || facilities.length === 0}
            >
              <option value="">Choose a facility...</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>
        </>
      );
    }

    // Review step
    const selectedFacility = facilities.find(f => f.id === selectedFacilityId);

    return (
      <>
        <div className="onboarding-review">
          <p className="onboarding-section-title">Your Details</p>

          <p className="onboarding-review-label">Full Name</p>
          <p className="onboarding-review-value">{firstName} {lastName}</p>

          <p className="onboarding-review-label">Contact Details</p>
          <p className="onboarding-review-value">{user?.email}</p>
          <p className="onboarding-review-value">{normalizePhoneNumber(phone) || phone}</p>

          <p className="onboarding-review-label">Registration Number</p>
          <p className="onboarding-review-value">{registrationNumber}</p>

          <p className="onboarding-review-label">Primary Facility</p>
          <p className="onboarding-review-value">{selectedFacility?.name || 'Not selected'}</p>
        </div>
      </>
    );
  };

  return (
    <main className="onboarding-page">
      <div className="onboarding-stage">
        <div className="onboarding-brand">
          <Image src="/logo.png" alt="YELIMA logo" width={96} height={96} />
          <span>YELIMA</span>
        </div>

        <section className="onboarding-shell compact">
          <header className="onboarding-header-bar">
            <p className="onboarding-step-counter">STEP {activeStep + 1} OF 3</p>
            <h1>{activeStep === 0 ? 'Personal Details' : activeStep === 1 ? 'Facility' : 'Review'}</h1>
            <div className="onboarding-progress-line">
              <span style={{ width: `${((activeStep + 1) / 3) * 100}%` }} />
            </div>

            <div className="onboarding-steps-row">
              {stepLabels.map((label, index) => (
                <div key={label} className={`onboarding-step-chip ${index === activeStep ? 'active' : ''}`}>
                  <span className="onboarding-step-dot">{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </header>

          {error && (
            <div style={{ 
              padding: '10px 12px', 
              backgroundColor: '#fee', 
              borderRadius: '6px',
              border: '1px solid #fcc',
              color: '#c33',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div className="onboarding-content-zone">
            {renderStepBody()}
          </div>
        </section>

        {activeStep === 2 && (
          <div className="onboarding-disclaimer-box">
            <span className="onboarding-disclaimer-icon">i</span>
            <p className="onboarding-disclaimer">
              By clicking "Submit", you certify that all information provided is accurate. Registration typically undergoes verification within 24-48 hours.
            </p>
          </div>
        )}

        <div className={`onboarding-controls ${activeStep === 0 ? 'single' : ''}`}>
          {activeStep > 0 ? (
            <button 
              type="button" 
              className="secondary small" 
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={isSubmitting}
            >
              Back
            </button>
          ) : <span />}

          <button
            type="button"
            className="primary small"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Loading...' : activeStep < 2 ? 'Save & Continue' : 'Submit'}
          </button>
        </div>
      </div>
    </main>
  );
}
