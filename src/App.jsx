import { useEffect, useState, useCallback } from 'react';
import { supabase, supabaseClient } from '@/lib/supabase';
import { exportPaymentsExcel } from '@/lib/exportExcel';
import PaymentRegisterModal from '@/components/PaymentRegisterModal';
import CustomerDetailModal from '@/components/CustomerDetailModal';
import BulkPaymentModal from '@/components/BulkPaymentModal';
import InvoiceModal from '@/components/InvoiceModal';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const dateKST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [todayPaid, setTodayPaid] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [overdue, setOverdue] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerModal, setCustomerModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customerRanking, setCustomerRanking] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, tp, ot, od, rp, records] = await Promise.all([
        supabase.getCustomers(),
        supabase.getTodayPaidTotal(),
        supabase.getOutstandingTotal(),
        supabase.getOverdueRecords(5),
        supabase.getRecentPayments(5),
        supabase.getPaymentRecords({ hasBalance: true }),
      ]);
      setCustomers(c);
      setTodayPaid(tp);
      setOutstanding(ot);
      setOverdue(od);
      setRecent(rp);
      setRecordsCount(records.length);

      // 업체별 미수 합계 랭킹
      const byCustomer = new Map();
      for (const r of records) {
        if (!r.customer_id) continue;
        const prev = byCustomer.get(r.customer_id) || { balance: 0, count: 0 };
        byCustomer.set(r.customer_id, {
          balance: prev.balance + Number(r.balance || 0),
          count: prev.count + 1,
        });
      }
      const ranking = [...byCustomer.entries()]
        .map(([id, v]) => ({ ...v, customer: c.find((x) => x.id === id) || { id, name: `#${id}` } }))
        .filter((x) => x.balance > 0)
        .sort((a, b) => b.balance - a.balance);
      setCustomerRanking(ranking);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // WebSocket 실시간 구독 (Step 7)
  useEffect(() => {
    const ch = supabaseClient
      .channel('pos-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => load())
      .subscribe();
    return () => { supabaseClient.removeChannel(ch); };
  }, [load]);

  const handleSync = async () => {
    if (syncing) return;
    if (!confirm('운영 앱의 주문 데이터를 읽어서 결제 레코드에 없는 주문을 자동 생성합니다.\n\n• 운영 orders 테이블은 READ만 (변경 없음)\n• 이미 생성된 주문은 중복 방지\n\n진행할까요?')) return;
    setSyncing(true); setSyncResult(null);
    try {
      const r = await supabase.syncOrdersToPaymentRecords();
      setSyncResult(r);
      await load();
    } catch (e) {
      alert('동기화 실패: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 8000);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const [records, history] = await Promise.all([
        supabase.getPaymentRecords({}),
        supabase.getPaymentHistory({}),
      ]);
      await exportPaymentsExcel({ records, history, customers });
    } catch (e) {
      console.error('exportExcel:', e);
      alert('Excel 내보내기 실패: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setExporting(false);
    }
  };

  const customerName = (id) => customers.find((c) => c.id === id)?.name || `#${id}`;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-5 py-4 flex items-center justify-between gap-2 sticky top-0 bg-[var(--background)]/95 backdrop-blur z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">💰</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-1.5 break-keep">
              MOVE 결제 관리
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex-shrink-0">BETA</span>
            </h1>
            <p className="text-[11px] text-[var(--muted-foreground)] break-keep">입출금 · 미수 · 이월 잔금 · 명세서</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setInvoiceOpen(true)}
            className="h-8 px-2 rounded-lg border border-[var(--border)] text-[11px] font-semibold hover:bg-[var(--secondary)] transition-colors"
            title="명세서"
          >
            📄
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="h-8 px-2 rounded-lg border border-[var(--border)] text-[11px] font-semibold hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
            title="Excel 내보내기"
          >
            {exporting ? '⟳' : '📊'}
          </button>
          <button
            onClick={load}
            className="h-8 w-8 rounded-lg border border-[var(--border)] text-xs font-semibold hover:bg-[var(--secondary)] transition-colors"
            disabled={loading}
            title="새로고침"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {/* 요약 카드 3개 */}
        <section className="grid grid-cols-3 gap-2">
          <SummaryCard label="오늘 입금" value={fmt(todayPaid)} unit="원" color="green" />
          <SummaryCard label="미수 합계" value={fmt(outstanding)} unit="원" color="red" />
          <SummaryCard label="연체" value={String(overdue.length)} unit="건" color="orange" />
        </section>

        {/* 전체 결제 레코드 카운트 + 동기화 */}
        <section className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted-foreground)]">등록된 미수 결제</span>
            <span className="font-bold">{fmt(recordsCount)}건</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full py-2 rounded-md text-xs font-semibold border border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] disabled:opacity-50"
          >
            {syncing ? '⟳ 동기화 중...' : '🔄 운영 주문 → 결제 레코드 동기화'}
          </button>
          {syncResult && (
            <div className="text-[11px] p-2 rounded bg-green-500/10 border border-green-500/30 text-green-300 leading-relaxed">
              ✅ 완료: 전체 {syncResult.total}건 중 <strong>{syncResult.inserted}건 신규 생성</strong>
              {syncResult.skippedAlreadySynced > 0 && <div>• 이미 동기화됨: {syncResult.skippedAlreadySynced}건</div>}
              {syncResult.skippedNoCustomer > 0 && <div>• 업체 매칭 실패: {syncResult.skippedNoCustomer}건</div>}
            </div>
          )}
        </section>

        {/* 연체 주문 */}
        <Panel title="🚨 연체 주문" emptyMessage="연체 없음 👍">
          {overdue.length > 0 && overdue.map((r) => (
            <div key={r.id} className="p-2.5 rounded-lg bg-[var(--secondary)] text-sm flex items-start gap-2">
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
            </div>
          ))}
        </Panel>

        {/* 업체별 미수 랭킹 */}
        <Panel title="🏢 업체별 미수" emptyMessage="미수 있는 업체 없음">
          {customerRanking.length > 0 && customerRanking.slice(0, 8).map((r) => (
            <button
              key={r.customer.id}
              onClick={() => setCustomerModal(r.customer)}
              className="w-full p-2.5 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 text-sm flex items-start gap-2 text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold break-keep">{r.customer.name || `#${r.customer.id}`}</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">미수 {r.count}건</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-red-400 text-sm">{fmt(r.balance)}원</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">&gt;</div>
              </div>
            </button>
          ))}
        </Panel>

        {/* 최근 입금 */}
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

        {/* 개발 로드맵 (진행 상태 표시) */}
        <section className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-xs font-bold mb-2 flex items-center gap-1.5">
            <span>🗺️</span> 개발 진행
          </h2>
          <ol className="space-y-1 text-[12px]">
            {[
              ['✅', '대시보드 (오늘 입금/미수/이월/연체)'],
              ['✅', '입금 등록 모달'],
              ['✅', '업체별 입출금 탭'],
              ['✅', '일괄 입금 자동 배분'],
              ['✅', '명세서 PNG/인쇄/클립보드'],
              ['✅', 'Excel 내보내기'],
              ['✅', 'WebSocket 실시간 반영'],
            ].map(([icon, title], i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="flex-shrink-0">{icon}</span>
                <span className={icon === '✅' ? 'line-through text-[var(--muted-foreground)]' : ''}>{title}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-[11px] text-yellow-200/80 leading-relaxed">
          <p className="font-semibold mb-1">⚠️ BETA 안내</p>
          <p>이 앱은 결제/미수 관리 테스트 환경입니다. 운영 POS 앱(pos-calculator-web)과 완전히 분리되어 있습니다.</p>
          <p className="mt-1">운영 DB는 <strong>읽기</strong>만, 결제 데이터는 신규 테이블에만 저장.</p>
        </section>

        <footer className="text-center text-[10px] text-[var(--muted-foreground)] pt-2 pb-8">
          pos-payments v1.1.0-beta · 고객 {fmt(customers.length)}명 연결
        </footer>
      </main>

      <PaymentRegisterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load(); }}
      />

      <CustomerDetailModal
        open={!!customerModal}
        customer={customerModal}
        onClose={() => setCustomerModal(null)}
        onBulkPay={(customer, records) => setBulkModal({ customer, records })}
        onAddPayment={(customer) => { setCustomerModal(null); setTimeout(() => setModalOpen(true), 100); }}
      />

      <BulkPaymentModal
        open={!!bulkModal}
        customer={bulkModal?.customer}
        records={bulkModal?.records}
        onClose={() => setBulkModal(null)}
        onSaved={() => { load(); setCustomerModal(null); }}
      />

      <InvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />

      {/* 플로팅 액션 버튼 (모바일 빠른 접근) */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-2xl flex items-center justify-center text-2xl font-bold hover:opacity-90 transition-all active:scale-95 z-40"
        aria-label="입금 등록"
      >
        +
      </button>
    </div>
  );
}

function SummaryCard({ label, value, unit, color }) {
  const colorMap = {
    green: 'text-green-400 bg-green-500/5 border-green-500/20',
    red: 'text-red-400 bg-red-500/5 border-red-500/20',
    orange: 'text-orange-400 bg-orange-500/5 border-orange-500/20',
  };
  return (
    <div className={`p-2.5 rounded-xl border ${colorMap[color]}`}>
      <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5 break-keep">{label}</div>
      <div className="font-bold text-base break-all leading-tight">{value}</div>
      <div className="text-[9px] text-[var(--muted-foreground)]">{unit}</div>
    </div>
  );
}

function Panel({ title, children, emptyMessage }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <section className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <h2 className="text-xs font-bold mb-2">{title}</h2>
      <div className="space-y-1.5">
        {hasContent ? children : (
          <p className="text-xs text-[var(--muted-foreground)] text-center py-4">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
