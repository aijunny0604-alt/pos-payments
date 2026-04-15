import { LayoutDashboard, Wallet, Building2, FileText, Settings } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

const navItems = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'payments', label: '입출금 내역', icon: Wallet },
  { id: 'customers', label: '업체별 미수', icon: Building2 },
  { id: 'invoices', label: '명세서', icon: FileText },
  { id: 'settings', label: '설정 / 동기화', icon: Settings },
];

function CountBadge({ count, isActive, color = 'destructive' }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
      style={{
        backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : `var(--${color})`,
        color: '#fff',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Sidebar({ currentPage, onNavigate, isOnline, outstanding = 0, overdueCount = 0 }) {
  const badgeMap = {
    customers: outstanding > 0 ? 1 : 0,
    payments: overdueCount,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
          <span className="text-base">💰</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">결제 관리</div>
          <div className="text-[10px] text-[var(--muted-foreground)] leading-tight">BETA</div>
        </div>
      </div>

      {/* Outstanding 요약 */}
      <div className="px-3 py-3 border-b border-[var(--border)] bg-red-500/5">
        <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">총 이월 잔금</div>
        <div className="text-base font-bold text-red-400 break-all leading-tight">{fmt(outstanding)}원</div>
        {overdueCount > 0 && (
          <div className="text-[10px] text-orange-400 mt-1">⚠️ 연체 {overdueCount}건</div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id;
          const badgeCount = badgeMap[id] || 0;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
              <CountBadge count={badgeCount} isActive={isActive} />
            </button>
          );
        })}
      </nav>

      {/* Connection Status */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {isOnline ? '실시간 연결됨' : '오프라인'}
        </div>
        <div className="px-3 py-1 text-[10px] text-[var(--muted-foreground)]">
          v1.3.0-beta · 운영 무영향
        </div>
      </div>
    </div>
  );
}
