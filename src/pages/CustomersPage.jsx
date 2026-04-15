import { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function CustomersPage({ customers, customerRanking, onOpenCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('outstanding'); // outstanding | all

  const list = useMemo(() => {
    let l;
    if (filter === 'outstanding') {
      l = customerRanking.map((r) => ({ ...r.customer, _balance: r.balance, _count: r.count }));
    } else {
      l = customers.map((c) => {
        const r = customerRanking.find((x) => x.customer.id === c.id);
        return { ...c, _balance: r?.balance || 0, _count: r?.count || 0 };
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      l = l.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    }
    return l;
  }, [customers, customerRanking, filter, search]);

  const totalOutstanding = customerRanking.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">업체 리스트</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filter === 'outstanding' ? `미수 ${customerRanking.length}곳` : `전체 ${customers.length}명`}
        </span>
      </div>

      {/* 총 미수 요약 */}
      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
        <div className="text-[10px] text-[var(--muted-foreground)]">전체 이월 잔금</div>
        <div className="text-2xl font-bold text-red-400 break-all">{fmt(totalOutstanding)}원</div>
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5">
        <FilterChip active={filter === 'outstanding'} onClick={() => setFilter('outstanding')}>
          🚨 미수 있음
        </FilterChip>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          전체
        </FilterChip>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="업체명 / 전화번호 검색"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
          style={{ fontSize: '16px' }}
        />
      </div>

      {/* 리스트 */}
      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-center text-[var(--muted-foreground)] py-8">결과 없음</p>
        ) : list.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpenCustomer(c)}
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] flex items-start gap-2 text-left transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="font-bold break-keep">{c.name || `#${c.id}`}</div>
              <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex flex-wrap gap-2">
                {c.phone && <span>📞 {c.phone}</span>}
                {c._count > 0 && <span>📋 미수 {c._count}건</span>}
              </div>
              {c.address && (
                <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 break-keep">📍 {c.address}</div>
              )}
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end justify-between gap-1">
              {c._balance > 0 ? (
                <div className="font-bold text-red-400 text-sm">{fmt(c._balance)}원</div>
              ) : (
                <div className="text-[10px] text-green-400">완납</div>
              )}
              <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-colors ${
        active
          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
          : 'bg-[var(--secondary)] border-[var(--border)] text-[var(--muted-foreground)]'
      }`}
    >
      {children}
    </button>
  );
}
