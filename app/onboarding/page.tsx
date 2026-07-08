"use client";

import Image from 'next/image';
import { useState } from 'react';

const stepLabels = ['Identity', 'Facility', 'Review'];

export default function OnboardingPage() {
  const [activeStep, setActiveStep] = useState(0);

  const renderStepBody = () => {
    if (activeStep === 0) {
      return (
        <>
          <p className="onboarding-section-title">Personal Information</p>
          <div className="onboarding-grid-two">
            <label>
              <span className="onboarding-field-label">First Name</span>
              <input placeholder="e.g Kelvin" />
            </label>
            <label>
              <span className="onboarding-field-label">Last Name</span>
              <input placeholder="e.g Doe" />
            </label>
          </div>

          <label>
            <span className="onboarding-field-label">Phone Number</span>
            <input placeholder="+233 55 700 0000" />
          </label>

          <p className="onboarding-section-title" style={{ marginTop: 8 }}>Professional Information</p>
          <label>
            <span className="onboarding-field-label">Nurse Registration Number</span>
            <input placeholder="REG/002-57-99-100" />
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
            <select defaultValue="">
              <option value="" disabled>e.g Kelvin</option>
              <option>Kumasi South Hospital</option>
              <option>Komfo Anokye Teaching Hospital</option>
              <option>Cape Coast Teaching Hospital</option>
            </select>
          </label>
        </>
      );
    }

    return (
      <>
        <div className="onboarding-review">
          <p className="onboarding-section-title">Your Details</p>

          <p className="onboarding-review-label">Full Name</p>
          <p className="onboarding-review-value">Dr. Sarah Elizabeth Montgomery</p>

          <p className="onboarding-review-label">Contact Details</p>
          <p className="onboarding-review-value">sarah@medical-example.com</p>
          <p className="onboarding-review-value">+1 (555) 0123-4567</p>

          <p className="onboarding-review-label">Registration Number</p>
          <p className="onboarding-review-value">MED-889-021-TX</p>

          <p className="onboarding-review-label">Primary Facility</p>
          <p className="onboarding-review-value">St. Jude's Medical Center</p>
          <p className="onboarding-review-value">North Wing, Houston, TX</p>
        </div>
      </>
    );
  };

  return (
    <main className="onboarding-page">
      <div className="onboarding-stage">
        <div className="onboarding-brand">
          <Image src="/logo.png" alt="YELIMA logo" width={22} height={22} />
          <span>YELIMA</span>
        </div>

        <section className="onboarding-shell compact">
          <header className="onboarding-header-bar">
            <p className="onboarding-step-counter">STEP 1 OF 3</p>
            <h1>{activeStep === 0 ? 'Personal Details' : 'Onboarding'}</h1>
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
            <button type="button" className="secondary small" onClick={() => setActiveStep(activeStep - 1)}>
              Back
            </button>
          ) : <span />}

          <button
            type="button"
            className="primary small"
            onClick={() => {
              if (activeStep < 2) {
                setActiveStep(activeStep + 1);
              } else {
                window.location.href = '/dashboard';
              }
            }}
          >
            {activeStep < 2 ? 'Save & Continue' : 'Submit'}
          </button>
        </div>
      </div>
    </main>
  );
}
