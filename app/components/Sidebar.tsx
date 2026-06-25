"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { navItems } from '../lib/dummy';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('hcp-auth-token');
    router.replace('/login');
  };

  return (
    <aside className="sidebar hcp-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="logo-mark sidebar-logo-mark">
            <Image src="/logo.png" alt="Zyptyk logo" width={18} height={18} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>Zyptyk</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.84rem' }}>HCP portal</p>
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
          <div className="avatar-badge">A</div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>Adwoa (HCP)</p>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Kumasi South Hosp</p>
          </div>
        </div>
        <button type="button" className="ghost small" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
