import { LayoutDashboard, Wallet, Building2, FileText, Settings, ShoppingCart } from 'lucide-react';

const mobileNavItems = [
  { id: 'dashboard', label: '홈', icon: LayoutDashboard },
  { id: 'orders', label: '주문', icon: ShoppingCart },
  { id: 'payments', label: '입출금', icon: Wallet },
  { id: 'customers', label: '업체', icon: Building2 },
  { id: 'invoices', label: '명세서', icon: FileText },
  { id: 'settings', label: '설정', icon: Settings },
];

function MobileBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-bold leading-none"
      style={{ backgroundColor: 'var(--destructive)', color: '#fff' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function MobileNav({ currentPage, onNavigate, overdueCount = 0 }) {
  const badgeMap = { payments: overdueCount };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[var(--card)] border-t border-[var(--border)] no-print">
      <div className="flex">
        {mobileNavItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id;
          const badgeCount = badgeMap[id] || 0;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[56px] py-2 text-[11px] transition-colors ${
                isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                <MobileBadge count={badgeCount} />
              </div>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
