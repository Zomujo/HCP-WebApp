"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getHealthWorkerNavItems, getPharmacyNavItems } from '../lib/dummy';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<'health-worker' | 'pharmacy' | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('hcp-user-role') as 'health-worker' | 'pharmacy' | null;
    setUserRole(role);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('hcp-auth-token');
    localStorage.removeItem('hcp-user-role');
    router.replace('/login');
  };

  const navItems = userRole === 'pharmacy' ? getPharmacyNavItems() : getHealthWorkerNavItems();
  const roleLabel = userRole === 'pharmacy' ? 'Pharmacy' : 'Health Worker portal';
  const facilityName = userRole === 'pharmacy' ? 'Central Pharmacy' : 'Kumasi South Hosp';
  const userName = userRole === 'pharmacy' ? 'James Kwakye' : 'Adwoa (HW)';

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
      </div>

      <nav>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="patient-pill">
          <div className="avatar-badge">{userName[0]}</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{userName}</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{facilityName}</p>
          </div>
        </div>
        <button type="button" className="ghost small" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
