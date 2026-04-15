import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { exportCustomerReport } from '@/lib/exportExcel';
import { FileSpreadsheet, Printer, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dateKST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CustomerDetailModal({ open, customer, onClose, onBulkPay, onAddPayment, onEditHistory, onQuickPay }) {
  const [tab, setTab] = useState('outstanding');
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setLoading(true);
    setTab('outstanding');
    (async () => {
      try {
        const [r, allHistory, allOrders] = await Promise.all([
          supabase.getPaymentRecords({ customerId: customer.id }),
          supabase.getPaymentHistory({}),
          supabase.getOrders(),
        ]);
        const recordIds = new Set(r.map((x) => x.id));
        const myHistory = allHistory.filter((h) => recordIds.has(h.payment_record_id));

        // 주문 매칭: 1) record.order_id 우선  2) name/phone 백업
        const orderIdSet = new Set(r.map((x) => x.order_id).filter(Boolean));
        const targetName = (customer.name || '').trim();
        const targetPhone = (customer.phone || '').trim();
        const myOrders = allOrders.filter((o) => {
          if (orderIdSet.has(o.id)) return true;
          if (targetName && (o.customer_name || '').trim() === targetName) return true;
          if (targetPhone && (o.customer_phone || '').trim() === targetPhone) return true;
          return false;
        });

        setRecords(r);
        setHistory(myHistory);
        setOrders(myOrders);
      } finally { setLoading(false); }
    })();
  }, [open, customer]);

  const outstandingRecords = useMemo(() => records.filter((r) => Number(r.balance) > 0), [records]);
  const outstandingTotal = useMemo(() => outstandingRecords.reduce((s, r) => s + Number(r.balance || 0), 0), [outstandingRecords]);
  const totalOrders = useMemo(() => orders.length, [orders]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [allRecords, allHistory, settings] = await Promise.all([
        supabase.getPaymentRecords({}),
        supabase.getPaymentHistory({}),
        supabase.getSettings(),
      ]);
      await exportCustomerReport({
        customer,
        records: allRecords,
        history: allHistory,
        settings,
        orders,
      });
    } catch (e) {
      alert('Excel 실패: ' + e.message);
    } finally { setExporting(false); }
  };

  const handlePrint = () => {
    document.body.classList.add('print-customer-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-customer-mode');
    }, 100);
  };

  if (!open || !customer) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 customer-detail-modal"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          body.print-customer-mode > *:not(.customer-detail-modal) { display: none !important; }
          body.print-customer-mode .customer-detail-modal {
            position: static !important; background: white !important; backdrop-filter: none !important;
            display: block !important; padding: 0 !important;
          }
          body.print-customer-mode .customer-detail-modal > div {
            box-shadow: none !important; border: none !important; max-height: none !important;
            background: white !important; color: black !important; max-width: 100% !important;
          }
          body.print-customer-mode .no-print { display: none !important; }
          body.print-customer-mode .customer-detail-modal table { color: black !important; }
        }
      `}</style>
      <div
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--primary)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold break-keep">🏢 {customer.name || `#${customer.id}`}</h3>
              <p className="text-[11px] text-[var(--muted-foreground)] break-keep mt-0.5">
                {customer.phone || '-'}
                {customer.address && <span className="ml-2">📍 {customer.address}</span>}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-[var(--secondary)]">✕</button>
          </div>
          {/* 액션 버튼 */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-center gap-1 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11px] font-bold disabled:opacity-50 no-print"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exporting ? '생성중...' : '엑셀 다운로드'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[11px] font-bold no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄
            </button>
          </div>
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
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        r.payment_status === 'partial' ? 'bg-orange-500/20 text-orange-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {r.payment_status === 'partial' ? '부분' : '미수'}
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newVal = !r.invoice_issued;
                          await supabase.updatePaymentRecord(r.id, {
                            invoice_issued: newVal,
                            invoice_issued_at: newVal ? new Date().toISOString() : null,
                          });
                          setRecords((prev) => prev.map((x) => x.id === r.id ? { ...x, invoice_issued: newVal } : x));
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          r.invoice_issued ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/15 text-orange-300'
                        }`}
                        title="세금계산서 발행 토글"
                      >
                        {r.invoice_issued ? '✅ 발행' : '⏳ 미발행'}
                      </button>
                    </div>
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
                  {/* 빠른 입금 버튼 */}
                  {onQuickPay && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onQuickPay(r, Number(r.balance))}
                        className="py-1.5 rounded-md bg-green-500/15 border border-green-500/40 text-green-400 text-[10px] font-bold"
                      >
                        ⚡ 잔액 전액 {fmt(r.balance)}
                      </button>
                      {onAddPayment && (
                        <button
                          onClick={() => onAddPayment(customer, r)}
                          className="py-1.5 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-[var(--muted-foreground)] text-[10px] font-bold"
                        >
                          ✏️ 직접 입력
                        </button>
                      )}
                    </div>
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
                <div key={h.id} className="p-3 rounded-lg bg-[var(--secondary)] text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-green-400">{fmt(h.amount)}원</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex flex-wrap gap-1.5">
                        <span>{h.method || '-'}</span>
                        {h.memo && <span className="break-words">· {h.memo}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap">{dateKST(h.paid_at)}</div>
                      {onEditHistory && (
                        <button
                          onClick={() => onEditHistory(h)}
                          className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                        >
                          ✏️ 수정
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'orders' && (
            <div className="space-y-2">
              {orders.length === 0 ? (
                <p className="text-sm text-center text-[var(--muted-foreground)] py-6">주문 내역 없음</p>
              ) : orders.slice(0, 50).map((o) => {
                const items = Array.isArray(o.items) ? o.items : [];
                const expanded = expandedOrder === o.id;
                return (
                  <div key={o.id} className="rounded-lg bg-[var(--secondary)] text-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedOrder(expanded ? null : o.id)}
                      className="w-full p-3 text-left hover:bg-[var(--accent)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            #{o.id}
                            {items.length > 0 && (
                              expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            {dateKST(o.created_at)} · {items.length}품목
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm">{fmt(o.total)}원</div>
                          {Number(o.total_returned) > 0 && (
                            <div className="text-[10px] text-orange-400">환불 {fmt(o.total_returned)}</div>
                          )}
                        </div>
                      </div>
                      {!expanded && items.length > 0 && (
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-1 break-words leading-snug">
                          {items.slice(0, 3).map((it) => it.name || it.product_name).filter(Boolean).join(', ')}
                          {items.length > 3 && ` 외 ${items.length - 3}건`}
                        </p>
                      )}
                    </button>
                    {expanded && items.length > 0 && (
                      <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-[var(--muted-foreground)] border-b border-[var(--border)]">
                              <th className="text-left py-1 font-normal">품목</th>
                              <th className="text-right py-1 font-normal w-10">수량</th>
                              <th className="text-right py-1 font-normal w-16">단가</th>
                              <th className="text-right py-1 font-normal w-20">소계</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => {
                              const qty = Number(it.quantity || 1);
                              const price = Number(it.price || 0);
                              return (
                                <tr key={i} className="border-b border-[var(--border)]/30 last:border-b-0">
                                  <td className="py-1.5 break-words leading-snug">{it.name || it.product_name || '-'}</td>
                                  <td className="text-right py-1.5">{qty}</td>
                                  <td className="text-right py-1.5">{fmt(price)}</td>
                                  <td className="text-right py-1.5 font-semibold">{fmt(qty * price)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-[var(--border)] font-bold">
                              <td colSpan="3" className="py-1.5 text-right">합계</td>
                              <td className="text-right py-1.5 text-[var(--primary)]">{fmt(o.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {o.memo && (
                          <p className="mt-2 p-2 rounded bg-[var(--background)] text-[10px] text-[var(--muted-foreground)] break-words">
                            📝 {o.memo}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {orders.length > 50 && (
                <p className="text-[11px] text-center text-[var(--muted-foreground)] pt-2">
                  최근 50건만 표시 (전체 {orders.length}건)
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
