import { useState, useMemo } from 'react';
import { Search, Phone, MapPin, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function CustomersPage({ customers, customerRanking, onOpenCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('outstanding');

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
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">업체 리스트</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filter === 'outstanding' ? `미수 ${customerRanking.length}곳` : `전체 ${customers.length}명`}
        </span>
      </div>

      {/* 총 미수 요약 */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-[var(--muted-foreground)] font-semibold">💰 전체 이월 잔금</div>
          <div className="text-2xl sm:text-3xl font-bold text-red-400 break-all leading-tight mt-0.5">
            {fmt(totalOutstanding)}원
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-[var(--muted-foreground)]">업체 수</div>
          <div className="text-xl font-bold">{customerRanking.length}</div>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 flex-shrink-0">
          <FilterChip active={filter === 'outstanding'} onClick={() => setFilter('outstanding')}>
            🚨 미수 있음
          </FilterChip>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체
          </FilterChip>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업체명 / 전화번호 검색"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      {/* 그리드 카드 */}
      {list.length === 0 ? (
        <p className="text-sm text-center text-[var(--muted-foreground)] py-12">결과 없음</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((c) => (
            <CustomerCard key={c.id} customer={c} onClick={() => onOpenCustomer(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ customer: c, onClick }) {
  const hasBalance = c._balance > 0;
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-4 rounded-2xl border-2 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
        hasBalance
          ? 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-500/10 hover:border-red-500/50'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
      }`}
    >
      {/* 상단: 이름 + 상태 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-bold break-keep leading-snug">
            {c.name || `#${c.id}`}
          </h3>
          {hasBalance ? (
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
              <AlertCircle className="w-3 h-3" /> 미수 {c._count}건
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3" /> 완납
            </div>
          )}
        </div>
      </div>

      {/* 중단: 잔금 크게 */}
      {hasBalance ? (
        <div className="mb-3">
          <div className="text-[10px] text-[var(--muted-foreground)] font-semibold">이월 잔금</div>
          <div className="text-xl sm:text-2xl font-bold text-red-400 break-all leading-tight">
            {fmt(c._balance)}원
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-[10px] text-[var(--muted-foreground)] font-semibold">잔금</div>
          <div className="text-lg font-semibold text-[var(--muted-foreground)]">—</div>
        </div>
      )}

      {/* 하단: 연락처/주소 */}
      <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)] border-t border-[var(--border)]/50 pt-2.5">
        {c.phone ? (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="break-keep">{c.phone}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 opacity-50">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>전화 미등록</span>
          </div>
        )}
        {c.address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="break-keep leading-snug line-clamp-2">{c.address}</span>
          </div>
        )}
      </div>

      {/* 코너 뱃지 (큰 금액 강조) */}
      {hasBalance && c._balance >= 1000000 && (
        <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
          고액
        </div>
      )}
    </button>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs rounded-lg border font-semibold transition-colors ${
        active
          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
          : 'bg-[var(--secondary)] border-[var(--border)] text-[var(--muted-foreground)]'
      }`}
    >
      {children}
    </button>
  );
}
