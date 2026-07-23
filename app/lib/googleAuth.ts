// Google OAuth utilities and hooks
import { useEffect } from 'react';
import { CONFIG } from './config';

declare global {
  interface Window {
    google?: any;
  }
}

let googleInitialized = false;
let tokenHandler: ((token: string) => void) | null = null;

function ensureGoogleInitialized() {
  if (!window.google) {
    throw new Error('Google script not loaded');
  }

  if (googleInitialized) {
    return;
  }

  window.google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: (response: any) => {
      if (response?.credential && tokenHandler) {
        tokenHandler(response.credential);
      }
    },
    // FedCM can be disabled in the browser/site settings; use legacy prompt mode.
    use_fedcm_for_prompt: false,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  googleInitialized = true;
}

// Load Google script
export function useGoogleScript() {
  useEffect(() => {
    if (document.getElementById('google-script')) return;

    const script = document.createElement('script');
    script.id = 'google-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Script stays loaded for potential future use
    };
  }, []);
}

// Initialize Google One Tap Sign-In
export function initializeGoogleOneTap(
  onSuccess: (credentialResponse: any) => void,
  onError?: () => void
) {
  if (!window.google) {
    console.error('Google script not loaded');
    return;
  }

  try {
    tokenHandler = (token: string) => onSuccess({ credential: token });
    ensureGoogleInitialized();

    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
      }
    );
  } catch (error) {
    console.error('Google initialization failed:', error);
    onError?.();
  }
}

// Manual Google Sign In (for button click)
export function signInWithGoogle(
  callback: (token: string) => void,
  onError?: (message: string) => void
) {
  if (!window.google) {
    console.error('Google script not loaded');
    onError?.('Google Sign-In is not ready yet. Please wait a second and try again.');
    return;
  }

  try {
    tokenHandler = callback;
    ensureGoogleInitialized();

    window.google.accounts.id.prompt((notification: any) => {
      if (notification?.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() || 'unknown';
        onError?.(`Google Sign-In could not be displayed (${reason}). Enable third-party sign-in in browser settings or use email/password.`);
      } else if (notification?.isSkippedMoment?.()) {
        const reason = notification.getSkippedReason?.() || 'unknown';
        onError?.(`Google Sign-In was skipped (${reason}). Please try again or use email/password.`);
      }
    });
  } catch (error) {
    console.error('Google sign-in initialization failed:', error);
    onError?.('Google Sign-In failed to initialize. Please refresh and try again.');
  }
}
