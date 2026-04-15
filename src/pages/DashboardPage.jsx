import { Wallet, AlertTriangle, TrendingUp, Plus } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dateKST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function DashboardPage({
  todayPaid, outstanding, overdue, recent, customerRanking, customers,
  onOpenCustomer, onOpenPayment,
}) {
  const customerName = (id) => customers.find((c) => c.id === id)?.name || `#${id}`;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 요약 카드 3개 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="오늘 입금"
          value={fmt(todayPaid)}
          unit="원"
          color="green"
        />
        <SummaryCard
          icon={Wallet}
          label="이월 잔금"
          value={fmt(outstanding)}
          unit="원"
          color="red"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="연체"
          value={String(overdue.length)}
          unit="건"
          color="orange"
        />
      </section>

      {/* 빠른 액션 */}
      <section className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenPayment}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          입금 등록
        </button>
        <button
          onClick={() => location.hash = '#invoices'}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-bold hover:bg-[var(--accent)] active:scale-[0.98] transition-all"
        >
          📄 명세서 발행
        </button>
      </section>

      {/* 2-Column Layout (desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 연체 주문 */}
        <Panel title="🚨 연체 주문" emptyMessage="연체 없음 👍">
          {overdue.length > 0 && overdue.map((r) => {
            const cust = customers.find((c) => c.id === r.customer_id);
            return (
              <button
                key={r.id}
                onClick={() => cust && onOpenCustomer(cust)}
                className="w-full p-3 rounded-lg bg-[var(--secondary)] text-sm flex items-start gap-2 text-left hover:bg-[var(--accent)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-semibold break-keep min-w-0">{customerName(r.customer_id)}</span>
                    {r.invoice_number && <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">#{r.invoice_number}</span>}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    납기: {r.due_date || '-'} · 총 {fmt(r.total_amount)}원
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-red-400 text-sm">{fmt(r.balance)}원</div>
                  <div className="text-[10px] text-red-300/70">미수</div>
                </div>
              </button>
            );
          })}
        </Panel>

        {/* 업체별 미수 랭킹 */}
        <Panel title="🏢 업체별 미수 TOP" emptyMessage="미수 있는 업체 없음">
          {customerRanking.length > 0 && customerRanking.slice(0, 8).map((r) => (
            <button
              key={r.customer.id}
              onClick={() => onOpenCustomer(r.customer)}
              className="w-full p-2.5 rounded-lg bg-[var(--secondary)] hover:bg-[var(--accent)] text-sm flex items-start gap-2 text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold break-keep">{r.customer.name || `#${r.customer.id}`}</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">미수 {r.count}건</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-red-400 text-sm">{fmt(r.balance)}원</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">›</div>
              </div>
            </button>
          ))}
        </Panel>
      </div>

      {/* 최근 입금 (전체 너비) */}
      <Panel title="💵 최근 입금" emptyMessage="입금 내역 없음">
        {recent.length > 0 && recent.map((p) => (
          <div key={p.id} className="p-2.5 rounded-lg bg-[var(--secondary)] text-sm flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{fmt(p.amount)}원</div>
              <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1.5 flex-wrap">
                {p.method && <span>{p.method}</span>}
                {p.memo && <span className="break-words">· {p.memo}</span>}
              </div>
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0 whitespace-nowrap">
              {dateKST(p.paid_at)}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, unit, color }) {
  const colorMap = {
    green: 'bg-green-500/5 border-green-500/20 text-green-400',
    red: 'bg-red-500/5 border-red-500/20 text-red-400',
    orange: 'bg-orange-500/5 border-orange-500/20 text-orange-400',
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted-foreground)] break-keep">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
      </div>
      <div className="font-bold text-2xl break-all leading-tight">{value}</div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{unit}</div>
    </div>
  );
}

function Panel({ title, children, emptyMessage }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <h2 className="text-sm font-bold mb-3">{title}</h2>
      <div className="space-y-2">
        {hasContent ? children : (
          <p className="text-xs text-[var(--muted-foreground)] text-center py-6">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
