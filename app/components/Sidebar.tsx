"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useEffect, useRef, useState } from 'react';

type NavIconName = 'overview' | 'appointments' | 'patients' | 'profile';

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
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 13.6A5.5 5.5 0 0 1 20.5 19" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5a6.5 6.5 0 0 1 11 0" />
    </svg>
  );
}

const healthWorkerNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/appointments', label: 'Appointments', icon: 'appointments' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

const pharmacyNavItems: NavItem[] = [
  { href: '/pharmacy/dashboard', label: 'Dashboard', icon: 'overview' },
  { href: '/pharmacy/patients', label: 'Patients', icon: 'patients' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  );
}

/**
 * Desktop/tablet: a fixed left sidebar.
 * Phone (<= 900px): the header becomes a slim top bar with an account menu, and the
 * nav becomes a bottom tab bar (see the "Mobile navigation" section in globals.css).
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAccountMenuOpen]);

  const navItems = user?.role === 'pharmacy-personnel' ? pharmacyNavItems : healthWorkerNavItems;
  const roleLabel = user?.role === 'pharmacy-personnel' ? 'Pharmacy Personnel' : 'HCP portal';
  const facilityName = user?.facility?.name || 'Primary Facility';
  const userName = user
    ? `${user.firstName || user.email?.split('@')[0] || 'User'}${user.lastName ? ` ${user.lastName}` : ''}`
    : 'User';
  const initials = (userName || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sidebar hcp-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="logo-mark sidebar-logo-mark">
            <Image src="/logo.png" alt="YELIMA logo" width={40} height={40} />
          </div>
          <div className="sidebar-brand-text">
            <p className="sidebar-brand-name">YELIMA</p>
            <p className="sidebar-brand-role">{roleLabel}</p>
          </div>
        </div>

        <div className="account-menu-anchor" ref={accountMenuRef}>
          <button
            type="button"
            className="account-trigger"
            onClick={() => setIsAccountMenuOpen((previous) => !previous)}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            {initials}
          </button>

          {isAccountMenuOpen && (
            <div className="account-menu" role="menu">
              <div className="account-menu-head">
                <div className="avatar-badge">{initials}</div>
                <div className="sidebar-user-text">
                  <p className="sidebar-user-name">{userName}</p>
                  <p className="sidebar-user-meta">{user?.email || facilityName}</p>
                </div>
              </div>
              <p className="account-menu-facility">{facilityName}</p>
              <button type="button" role="menuitem" className="account-menu-item danger" onClick={handleLogout}>
                <LogoutIcon />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="sidebar-section-label">Menu</p>
      <nav className="sidebar-nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden>
              <NavIcon name={item.icon} />
            </span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="hcp-user-footer-card">
          <div className="avatar-badge">{initials}</div>
          <div className="sidebar-user-text">
            <p className="sidebar-user-name" title={userName}>{userName}</p>
            <p className="sidebar-user-meta" title={facilityName}>{facilityName}</p>
          </div>
          <button type="button" className="sidebar-logout" onClick={handleLogout} aria-label="Log out" title="Log out">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
