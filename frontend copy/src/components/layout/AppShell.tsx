import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Sidebar becomes fixed on desktop + drawer on mobile */}
      <Sidebar />

      {/* Shift content only on md+ (because sidebar is fixed there) */}
      <div className="flex min-h-dvh flex-col md:pl-64">
        {/* Top Navigation (UNCHANGED) */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
