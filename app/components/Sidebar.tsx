"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState } from 'react';

const healthWorkerNavItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/patients', label: 'Patients' },
  { href: '/chats', label: 'Chats' },
  { href: '/profile', label: 'Profile' },
];

const pharmacyNavItems = [
  { href: '/pharmacy/dashboard', label: 'Dashboard' },
  { href: '/pharmacy/patients', label: 'Patients' },
  { href: '/pharmacy/chats', label: 'Chats' },
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
  const roleLabel = user?.role === 'pharmacy-personnel' ? 'Pharmacy Personnel' : 'Health Worker portal';
  const facilityName = user?.facility?.name || 'Primary Facility';
  const userName = user ? `${user.firstName || user.email?.split('@')[0] || 'User'}` : 'User';

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
            <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="patient-pill">
            <div className="avatar-badge">{(userName || 'U')[0]?.toUpperCase()}</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{userName}</p>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{facilityName}</p>
            </div>
          </div>

          <button type="button" className="ghost small" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
