import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';

export default function AppLayout({ children, currentPage, onNavigate, isOnline, todayPaid, outstanding, overdueCount }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const toggleHandler = () => setSidebarOpen((p) => !p);
    const openHandler = () => setSidebarOpen(true);
    window.addEventListener('toggle-sidebar', toggleHandler);
    window.addEventListener('open-sidebar', openHandler);
    return () => {
      window.removeEventListener('toggle-sidebar', toggleHandler);
      window.removeEventListener('open-sidebar', openHandler);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-[var(--border)] bg-[var(--card)]">
        <Sidebar
          currentPage={currentPage}
          onNavigate={onNavigate}
          isOnline={isOnline}
          outstanding={outstanding}
          overdueCount={overdueCount}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[45] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-[var(--card)] shadow-xl">
            <Sidebar
              currentPage={currentPage}
              onNavigate={(page) => { onNavigate(page); setSidebarOpen(false); }}
              isOnline={isOnline}
              outstanding={outstanding}
              overdueCount={overdueCount}
            />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen((p) => !p)}
          currentPage={currentPage}
          isOnline={isOnline}
          todayPaid={todayPaid}
        />
        <main
          className="flex-1 min-h-0 overflow-y-auto scroll-smooth p-3 sm:p-4 md:p-6 pb-20 md:pb-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav currentPage={currentPage} onNavigate={onNavigate} overdueCount={overdueCount} />
    </div>
  );
}
