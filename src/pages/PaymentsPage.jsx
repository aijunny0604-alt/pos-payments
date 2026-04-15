import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Plus, Calendar, Edit2 } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dateKST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PaymentsPage({ customers, onOpenPayment, onEditHistory }) {
  const [tab, setTab] = useState('records'); // records | history
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [statusFilter, setStatusFilter] = useState('all'); // all | unpaid | partial | paid
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.getPaymentRecords({}),
      supabase.getPaymentHistory({ limit: 200 }),
    ]).then(([r, h]) => { setRecords(r); setHistory(h); }).finally(() => setLoading(false));
  }, []);

  const customerName = (id) => customers.find((c) => c.id === id)?.name || `#${id}`;

  const filteredRecords = useMemo(() => {
    let list = records;
    if (statusFilter !== 'all') list = list.filter((r) => r.payment_status === statusFilter);
    if (customerFilter !== 'all') list = list.filter((r) => String(r.customer_id) === String(customerFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.invoice_number || '').toLowerCase().includes(q) ||
        (r.order_id || '').toString().includes(q) ||
        customerName(r.customer_id).toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, statusFilter, customerFilter, search, customers]);

  const filteredHistory = useMemo(() => {
    let list = history;
    if (customerFilter !== 'all') {
      const recordIds = records.filter((r) => String(r.customer_id) === String(customerFilter)).map((r) => r.id);
      list = list.filter((h) => recordIds.includes(h.payment_record_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((h) =>
        (h.method || '').toLowerCase().includes(q) ||
        (h.memo || '').toLowerCase().includes(q) ||
        String(h.amount).includes(q)
      );
    }
    return list;
  }, [history, records, customerFilter, search]);

  const summary = useMemo(() => {
    const total = filteredRecords.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const paid = filteredRecords.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const balance = filteredRecords.reduce((s, r) => s + Number(r.balance || 0), 0);
    return { total, paid, balance, count: filteredRecords.length };
  }, [filteredRecords]);

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{tab === 'records' ? '결제 레코드' : '입금 이력'}</h2>
        <button
          onClick={onOpenPayment}
          className="flex items-center gap-1 h-9 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> 입금 등록
        </button>
      </div>

      {/* 탭 전환 */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <TabButton active={tab === 'records'} onClick={() => setTab('records')}>
          📋 결제 레코드 ({records.length})
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          💵 입금 이력 ({history.length})
        </TabButton>
      </div>

      {/* 필터 (records 탭만) */}
      {tab === 'records' && (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['all', '전체', 'gray'],
              ['unpaid', '미수', 'red'],
              ['partial', '부분', 'orange'],
              ['paid', '완납', 'green'],
            ].map(([k, l, c]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-colors ${
                  statusFilter === k
                    ? `bg-${c === 'gray' ? '[var(--primary)]' : c + '-500/20'} border-${c === 'gray' ? '[var(--primary)]' : c + '-500/40'} text-${c === 'gray' ? 'white' : c + '-300'}`
                    : 'bg-[var(--secondary)] border-[var(--border)] text-[var(--muted-foreground)]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* 요약 */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <SummaryStat label="필터 결과" value={`${summary.count}건`} />
            <SummaryStat label="총액" value={`${fmt(summary.total)}원`} />
            <SummaryStat label="잔금 합계" value={`${fmt(summary.balance)}원`} color="red" />
          </div>
        </>
      )}

      {/* 검색 + 업체 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'records' ? '세금계산서/주문번호/업체 검색' : '방법/메모/금액 검색'}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            style={{ fontSize: '16px' }}
          />
        </div>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
          style={{ fontSize: '16px' }}
        >
          <option value="all">전체 업체</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
        </select>
      </div>

      {/* 리스트 */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-center text-[var(--muted-foreground)] py-8">로딩 중...</p>
        ) : tab === 'records' ? (
          filteredRecords.length === 0 ? (
            <p className="text-sm text-center text-[var(--muted-foreground)] py-8">조건에 맞는 결제 레코드 없음</p>
          ) : filteredRecords.map((r) => (
            <div key={r.id} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold break-keep">{customerName(r.customer_id)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">
                      #{r.invoice_number || r.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                    {r.invoice_date && <>발행 {r.invoice_date}</>}
                    {r.due_date && <> · 납기 {r.due_date}</>}
                    {r.order_id && <> · 주문 #{r.order_id}</>}
                  </div>
                </div>
                <StatusBadge status={r.payment_status} />
              </div>
              <div className="flex items-end justify-between gap-2 pt-1.5 border-t border-[var(--border)]">
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  총 {fmt(r.total_amount)} / 입금 {fmt(r.paid_amount)}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--muted-foreground)]">잔금</div>
                  <div className={`text-base font-bold ${Number(r.balance) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {fmt(r.balance)}원
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          filteredHistory.length === 0 ? (
            <p className="text-sm text-center text-[var(--muted-foreground)] py-8">조건에 맞는 입금 이력 없음</p>
          ) : filteredHistory.map((h) => {
            const rec = records.find((r) => r.id === h.payment_record_id);
            return (
              <div key={h.id} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-green-400 text-base">{fmt(h.amount)}원</span>
                      {h.method && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">{h.method}</span>}
                    </div>
                    {rec && (
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        {customerName(rec.customer_id)} · #{rec.invoice_number || rec.id}
                      </div>
                    )}
                    {h.memo && (
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 break-words">📝 {h.memo}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-[10px] text-[var(--muted-foreground)]">{dateKST(h.paid_at)}</div>
                    {onEditHistory && (
                      <button
                        onClick={() => onEditHistory(h)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> 수정
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
        active ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted-foreground)]'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    paid: 'bg-green-500/20 text-green-300',
    partial: 'bg-orange-500/20 text-orange-300',
    unpaid: 'bg-red-500/20 text-red-300',
  };
  const label = { paid: '완납', partial: '부분', unpaid: '미수' }[status] || status;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${map[status] || 'bg-gray-500/20'}`}>{label}</span>;
}

function SummaryStat({ label, value, color }) {
  return (
    <div className="p-2 rounded-lg bg-[var(--secondary)]">
      <div className="text-[10px] text-[var(--muted-foreground)]">{label}</div>
      <div className={`font-bold text-sm break-all leading-tight ${color === 'red' ? 'text-red-400' : ''}`}>{value}</div>
    </div>
  );
}
