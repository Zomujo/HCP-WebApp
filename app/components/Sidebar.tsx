"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '../lib/dummy';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="avatar-badge">Z</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>Zomjuo</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.95rem' }}>HCP portal</p>
          </div>
        </div>
        <p className="text-muted" style={{ margin: 0, maxWidth: 220, lineHeight: 1.6 }}>
          Manage chronic care and clinical workflows with patient data, appointments, and messaging.
        </p>
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
          <div className="avatar-badge">A</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>Adwoa (HCP)</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Kumasi South Hosp</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
