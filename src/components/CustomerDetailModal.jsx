import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dateKST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CustomerDetailModal({ open, customer, onClose, onBulkPay, onAddPayment }) {
  const [tab, setTab] = useState('outstanding'); // outstanding | payments | orders | invoices
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setLoading(true);
    setTab('outstanding');
    Promise.all([
      supabase.getPaymentRecords({ customerId: customer.id }),
      supabase.getPaymentHistory({}).then(async (all) => {
        const recordIds = (await supabase.getPaymentRecords({ customerId: customer.id })).map((r) => r.id);
        return all.filter((h) => recordIds.includes(h.payment_record_id));
      }),
      supabase.getOrders().then((o) => o.filter((x) => x.customer_id === customer.id)),
    ]).then(([r, h, o]) => {
      setRecords(r);
      setHistory(h);
      setOrders(o);
    }).finally(() => setLoading(false));
  }, [open, customer]);

  const outstandingRecords = useMemo(() => records.filter((r) => Number(r.balance) > 0), [records]);
  const outstandingTotal = useMemo(() => outstandingRecords.reduce((s, r) => s + Number(r.balance || 0), 0), [outstandingRecords]);
  const totalOrders = useMemo(() => orders.length, [orders]);

  if (!open || !customer) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--primary)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-[var(--border)] flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold break-keep">🏢 {customer.name || `#${customer.id}`}</h3>
            <p className="text-[11px] text-[var(--muted-foreground)] break-keep mt-0.5">
              {customer.phone || '-'}
              {customer.address && <span className="ml-2">📍 {customer.address}</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-[var(--secondary)]">✕</button>
        </div>

        {/* 요약 */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <StatBox label="이월 잔금" value={fmt(outstandingTotal)} unit="원" color="red" />
            <StatBox label="주문" value={fmt(totalOrders)} unit="건" color="blue" />
            <StatBox label="입금 내역" value={fmt(history.length)} unit="건" color="green" />
          </div>
          {outstandingTotal > 0 && onBulkPay && (
            <button
              onClick={() => onBulkPay(customer, outstandingRecords)}
              className="w-full mt-2 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/25"
            >
              💳 일괄 입금 ({fmt(outstandingTotal)}원 자동 배분)
            </button>
          )}
          {onAddPayment && (
            <button
              onClick={() => onAddPayment(customer, null)}
              className="w-full mt-1.5 py-2 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] text-xs font-bold hover:bg-[var(--primary)]/25"
            >
              + {customer.name || '업체'}에 바로 입금
            </button>
          )}
        </div>

        {/* 탭 */}
        <div className="px-4 pt-3 flex gap-1 text-xs border-b border-[var(--border)]">
          {[
            ['outstanding', '미수', outstandingRecords.length],
            ['payments', '입금', history.length],
            ['orders', '주문', orders.length],
          ].map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 font-semibold border-b-2 transition-colors ${
                tab === key ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted-foreground)]'
              }`}
            >
              {label}
              {count > 0 && <span className="ml-1 text-[10px]">({count})</span>}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading && <p className="text-sm text-center text-[var(--muted-foreground)] py-6">로딩...</p>}

          {!loading && tab === 'outstanding' && (
            <div className="space-y-2">
              {outstandingRecords.length === 0 ? (
                <p className="text-sm text-center text-[var(--muted-foreground)] py-6">미수 없음 👍</p>
              ) : outstandingRecords.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-[var(--secondary)] text-sm space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold break-words">
                        {r.invoice_number ? `#${r.invoice_number}` : `레코드 #${r.id}`}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        {r.invoice_date && <>발행: {r.invoice_date} · </>}
                        {r.due_date && <>납기: {r.due_date} · </>}
                        {r.order_id && <>주문 #{r.order_id}</>}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                      r.payment_status === 'partial' ? 'bg-orange-500/20 text-orange-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {r.payment_status === 'partial' ? '부분' : '미수'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-1 border-t border-[var(--border)]">
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      총 {fmt(r.total_amount)} / 입금 {fmt(r.paid_amount)}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[var(--muted-foreground)]">잔금</div>
                      <div className="text-base font-bold text-red-400">{fmt(r.balance)}원</div>
                    </div>
                  </div>
                  {onAddPayment && (
                    <button
                      onClick={() => onAddPayment(customer, r)}
                      className="w-full mt-1 py-1.5 rounded-md bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] text-xs font-semibold"
                    >
                      + 이 건에 입금
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'payments' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-center text-[var(--muted-foreground)] py-6">입금 내역 없음</p>
              ) : history.map((h) => (
                <div key={h.id} className="p-3 rounded-lg bg-[var(--secondary)] text-sm flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-green-400">{fmt(h.amount)}원</div>
                    <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex flex-wrap gap-1.5">
                      <span>{h.method || '-'}</span>
                      {h.memo && <span className="break-words">· {h.memo}</span>}
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap flex-shrink-0">
                    {dateKST(h.paid_at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'orders' && (
            <div className="space-y-2">
              {orders.length === 0 ? (
                <p className="text-sm text-center text-[var(--muted-foreground)] py-6">주문 내역 없음</p>
              ) : orders.slice(0, 30).map((o) => (
                <div key={o.id} className="p-3 rounded-lg bg-[var(--secondary)] text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">#{o.order_number || o.id}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        {dateKST(o.created_at)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm">{fmt(o.total_price || o.total_amount)}원</div>
                    </div>
                  </div>
                  {o.items && Array.isArray(o.items) && o.items.length > 0 && (
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1 break-words leading-snug">
                      {o.items.slice(0, 3).map((it) => it.name || it.product_name).filter(Boolean).join(', ')}
                      {o.items.length > 3 && ` 외 ${o.items.length - 3}건`}
                    </p>
                  )}
                </div>
              ))}
              {orders.length > 30 && (
                <p className="text-[11px] text-center text-[var(--muted-foreground)] pt-2">
                  최근 30건만 표시 (전체 {orders.length}건)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color }) {
  const colorMap = {
    red: 'bg-red-500/5 border-red-500/20 text-red-400',
    blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/5 border-green-500/20 text-green-400',
  };
  return (
    <div className={`p-2 rounded-lg border ${colorMap[color]}`}>
      <div className="text-[10px] text-[var(--muted-foreground)] break-keep">{label}</div>
      <div className="font-bold text-sm break-all leading-tight">{value}</div>
      <div className="text-[9px] text-[var(--muted-foreground)]">{unit}</div>
    </div>
  );
}
