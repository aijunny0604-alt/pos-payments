import { useEffect, useState, useCallback } from 'react';
import { supabase, supabaseClient } from '@/lib/supabase';
import { exportPaymentsExcel } from '@/lib/exportExcel';

import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import OrdersPage from '@/pages/OrdersPage';
import PaymentsPage from '@/pages/PaymentsPage';
import CustomersPage from '@/pages/CustomersPage';
import InvoicesPage from '@/pages/InvoicesPage';
import SettingsPage from '@/pages/SettingsPage';
import AuthPage, { checkAuth } from '@/pages/AuthPage';

import PaymentRegisterModal from '@/components/PaymentRegisterModal';
import CustomerDetailModal from '@/components/CustomerDetailModal';
import BulkPaymentModal from '@/components/BulkPaymentModal';
import PaymentEditModal from '@/components/PaymentEditModal';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  // 라우팅
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['dashboard', 'orders', 'payments', 'customers', 'invoices', 'settings'].includes(hash) ? hash : 'dashboard';
  });

  // 데이터
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [todayPaid, setTodayPaid] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [overdue, setOverdue] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [allRecords, setAllRecords] = useState([]);
  const [customerRanking, setCustomerRanking] = useState([]);
  const [isOnline, setIsOnline] = useState(true);

  // 모달
  const [paymentModal, setPaymentModal] = useState({ open: false, customerId: null, recordId: null });
  const [customerModal, setCustomerModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [editModal, setEditModal] = useState(null);

  // 동작
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  // 인증
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await supabase.getSettings();
      const ok = await checkAuth(settings);
      setAuthed(ok);
      setAuthChecked(true);
    })();
  }, []);

  // 라우팅: hash 변경 시 동기화
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'orders', 'payments', 'customers', 'invoices', 'settings'].includes(hash)) {
        setCurrentPage(hash);
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = (page) => {
    window.location.hash = `#${page}`;
    setCurrentPage(page);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, tp, ot, od, rp, allRecords] = await Promise.all([
        supabase.getCustomers(),
        supabase.getTodayPaidTotal(),
        supabase.getOutstandingTotal(),
        supabase.getOverdueRecords(10),
        supabase.getRecentPayments(10),
        supabase.getPaymentRecords({}),
      ]);
      setCustomers(c);
      setTodayPaid(tp);
      setOutstanding(ot);
      setOverdue(od);
      setRecent(rp);
      setRecordsCount(allRecords.length);
      setAllRecords(allRecords);

      // 업체별 미수 랭킹
      const byCustomer = new Map();
      for (const r of allRecords) {
        if (!r.customer_id || Number(r.balance) <= 0) continue;
        const prev = byCustomer.get(r.customer_id) || { balance: 0, count: 0 };
        byCustomer.set(r.customer_id, {
          balance: prev.balance + Number(r.balance),
          count: prev.count + 1,
        });
      }
      const ranking = [...byCustomer.entries()]
        .map(([id, v]) => ({ ...v, customer: c.find((x) => x.id === id) || { id, name: `#${id}` } }))
        .sort((a, b) => b.balance - a.balance);
      setCustomerRanking(ranking);
      setIsOnline(true);
    } catch (e) {
      console.error('load:', e);
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // WebSocket 실시간 구독
  useEffect(() => {
    const ch = supabaseClient
      .channel('pos-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => load())
      .subscribe();
    return () => { supabaseClient.removeChannel(ch); };
  }, [load]);

  // 동기화 (주문 + 저장된 장바구니)
  const handleSync = async () => {
    if (syncing) return;
    if (!confirm('운영 앱의 주문 + 저장된 장바구니를 결제 레코드로 동기화합니다.\n\n• 운영 데이터는 READ만 (변경 없음)\n• 이미 동기화된 건은 스킵\n• 장바구니는 CART- prefix로 구분\n\n진행할까요?')) return;
    setSyncing(true); setSyncResult(null);
    try {
      const r = await supabase.syncAllToPaymentRecords();
      // 기존 포맷과 호환되도록 합산 결과 + 분리 상세 모두 전달
      setSyncResult({
        total: r.orders.total + r.carts.total,
        inserted: r.totalInserted,
        skippedAlreadySynced: r.orders.skippedAlreadySynced + r.carts.skippedAlreadySynced,
        skippedNoCustomer: r.orders.skippedNoCustomer + r.carts.skippedNoCustomer,
        ordersDetail: r.orders,
        cartsDetail: r.carts,
      });
      await load();
    } catch (e) {
      alert('동기화 실패: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 15000);
    }
  };

  // Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const [records, history] = await Promise.all([
        supabase.getPaymentRecords({}),
        supabase.getPaymentHistory({}),
      ]);
      await exportPaymentsExcel({ records, history, customers });
    } catch (e) {
      console.error(e);
      alert('Excel 실패: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // 빠른 입금 (one-tap)
  const handleQuickPay = async (record, amount) => {
    if (!record || !amount || amount <= 0) return;
    if (!confirm(`${record.invoice_number || `#${record.id}`}\n잔금: ${record.balance.toLocaleString()}원\n\n${amount.toLocaleString()}원 입금 등록하시겠습니까?`)) return;
    try {
      await supabase.addPaymentHistory({
        payment_record_id: record.id,
        amount,
        method: '계좌이체',
        memo: '빠른 입금',
        type: 'income',
      });
      await load();
    } catch (e) {
      alert('빠른 입금 실패: ' + e.message);
    }
  };

  // 인증 미통과 시 로그인 페이지
  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--muted-foreground)]">로딩 중...</div>;
  }
  if (!authed) {
    return <AuthPage onAuthed={() => setAuthed(true)} />;
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={navigate}
      isOnline={isOnline}
      todayPaid={todayPaid}
      outstanding={outstanding}
      overdueCount={overdue.length}
    >
      {/* 연체 알림 배너 */}
      {overdue.length > 0 && !alertDismissed && currentPage === 'dashboard' && (
        <div className="mb-4 p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2 max-w-4xl mx-auto">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-300">⚠️ 연체 주문 {overdue.length}건</p>
            <p className="text-xs text-red-300/80 mt-0.5 break-keep">
              납기일 지난 미수 — 빠른 수금 또는 명세서 송부 권장
            </p>
          </div>
          <button
            onClick={() => navigate('payments')}
            className="text-[10px] px-2.5 py-1 rounded-md bg-red-500 text-white font-bold flex-shrink-0"
          >
            확인
          </button>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-[var(--muted-foreground)] flex-shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {currentPage === 'dashboard' && (
        <DashboardPage
          todayPaid={todayPaid}
          outstanding={outstanding}
          overdue={overdue}
          recent={recent}
          customerRanking={customerRanking}
          customers={customers}
          records={allRecords}
          onOpenCustomer={(c) => setCustomerModal(c)}
          onOpenPayment={() => setPaymentModal({ open: true, customerId: null, recordId: null })}
        />
      )}

      {currentPage === 'orders' && (
        <OrdersPage customers={customers} />
      )}

      {currentPage === 'payments' && (
        <PaymentsPage
          customers={customers}
          onOpenPayment={() => setPaymentModal({ open: true, customerId: null, recordId: null })}
          onEditHistory={(h) => setEditModal(h)}
          onOpenCustomer={(c) => setCustomerModal(c)}
        />
      )}

      {currentPage === 'customers' && (
        <CustomersPage
          customers={customers}
          customerRanking={customerRanking}
          onOpenCustomer={(c) => setCustomerModal(c)}
        />
      )}

      {currentPage === 'invoices' && (
        <InvoicesPage customers={customers} />
      )}

      {currentPage === 'settings' && (
        <SettingsPage
          customers={customers}
          recordsCount={recordsCount}
          syncing={syncing}
          syncResult={syncResult}
          exporting={exporting}
          onSync={handleSync}
          onExport={handleExport}
          onRefresh={load}
        />
      )}

      {/* 전역 모달 */}
      <PaymentRegisterModal
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, customerId: null, recordId: null })}
        onSaved={() => { load(); }}
        initialCustomerId={paymentModal.customerId}
        initialRecordId={paymentModal.recordId}
      />

      <CustomerDetailModal
        open={!!customerModal}
        customer={customerModal}
        onClose={() => setCustomerModal(null)}
        onBulkPay={(customer, records) => setBulkModal({ customer, records })}
        onAddPayment={(customer, record) => {
          setCustomerModal(null);
          setPaymentModal({ open: true, customerId: customer?.id || null, recordId: record?.id || null });
        }}
        onEditHistory={(h) => setEditModal(h)}
        onQuickPay={handleQuickPay}
      />

      <BulkPaymentModal
        open={!!bulkModal}
        customer={bulkModal?.customer}
        records={bulkModal?.records}
        onClose={() => setBulkModal(null)}
        onSaved={() => { load(); setCustomerModal(null); }}
      />

      <PaymentEditModal
        open={!!editModal}
        history={editModal}
        onClose={() => setEditModal(null)}
        onSaved={() => { load(); }}
      />
    </AppLayout>
  );
}
