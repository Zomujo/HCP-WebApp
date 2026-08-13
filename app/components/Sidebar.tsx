"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState } from 'react';

type NavIconName = 'overview' | 'appointments' | 'patients' | 'chats' | 'profile';

interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === 'overview') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9.5L12 3l9 6.5" />
        <path d="M5.5 9v11h13V9" />
      </svg>
    );
  }

  if (name === 'appointments') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M7 3.5v3M17 3.5v3M3.5 9h17" />
      </svg>
    );
  }

  if (name === 'patients') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }

  if (name === 'chats') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4.5 6.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4.5 3v-3H4.5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

const healthWorkerNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/appointments', label: 'Appointments', icon: 'appointments' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '#', label: 'Coming Soon', icon: 'chats' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

const pharmacyNavItems: NavItem[] = [
  { href: '/pharmacy/dashboard', label: 'Dashboard', icon: 'overview' },
  { href: '/pharmacy/patients', label: 'Patients', icon: 'patients' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const navItems = user?.role === 'pharmacy-personnel' ? pharmacyNavItems : healthWorkerNavItems;
  const roleLabel = user?.role === 'pharmacy-personnel' ? 'Pharmacy Personnel' : 'HCP portal';
  const facilityName = user?.facility?.name || 'Primary Facility';
  const userName = user
    ? `${user.firstName || user.email?.split('@')[0] || 'User'}${user.lastName ? ` ${user.lastName}` : ''}`
    : 'User';

  return (
    <aside className="sidebar hcp-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="logo-mark sidebar-logo-mark">
            <Image src="/logo.png" alt="YELIMA logo" width={18} height={18} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>YELIMA</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.84rem' }}>{roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-mobile-toggle"
          onClick={() => setIsMobileMenuOpen((previous) => !previous)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="sidebar-mobile-collapsible"
        >
          {isMobileMenuOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <div id="sidebar-mobile-collapsible" className={`sidebar-collapsible ${isMobileMenuOpen ? 'open' : ''}`}>
        <nav>
          {navItems.map((item) => (
            item.href === '#' ? (
              <div key={item.label} className="nav-link disabled-nav-link" aria-disabled="true" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                <span className="nav-icon" aria-hidden>
                  <NavIcon name={item.icon} />
                </span>
                {item.label}
              </div>
            ) : (
              <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`}>
                <span className="nav-icon" aria-hidden>
                  <NavIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="hcp-user-footer-card">
            <div className="avatar-badge">{(userName || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem' }}>
                {userName} ({user?.role === 'pharmacy-personnel' ? 'Pharmacy' : 'HCP'})
              </p>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.76rem' }}>{facilityName}</p>
            </div>
          </div>

          <button type="button" className="ghost small sidebar-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </aside>
  );
}
