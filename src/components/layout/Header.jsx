import { Menu } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

const pageTitles = {
  dashboard: '대시보드',
  payments: '입출금 내역',
  customers: '업체별 미수',
  invoices: '명세서',
  settings: '설정',
};

export default function Header({ onMenuClick, currentPage, isOnline, todayPaid }) {
  return (
    <header className="flex items-center h-14 px-4 border-b border-[var(--border)] bg-[var(--card)] no-print sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="ml-2 md:ml-0 text-base font-bold flex items-center gap-2">
        {pageTitles[currentPage] || '결제 관리'}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
          BETA
        </span>
      </h1>
      <div className="flex-1" />
      {todayPaid > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
          <span className="font-semibold">오늘 입금</span>
          <span className="font-bold">{fmt(todayPaid)}원</span>
        </div>
      )}
      <div className={`ml-2 w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
    </header>
  );
}
