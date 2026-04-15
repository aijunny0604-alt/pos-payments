import { useEffect, useState, useCallback } from 'react';
import { supabase, supabaseClient } from '@/lib/supabase';
import { exportPaymentsExcel } from '@/lib/exportExcel';

import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import PaymentsPage from '@/pages/PaymentsPage';
import CustomersPage from '@/pages/CustomersPage';
import InvoicesPage from '@/pages/InvoicesPage';
import SettingsPage from '@/pages/SettingsPage';

import PaymentRegisterModal from '@/components/PaymentRegisterModal';
import CustomerDetailModal from '@/components/CustomerDetailModal';
import BulkPaymentModal from '@/components/BulkPaymentModal';
import PaymentEditModal from '@/components/PaymentEditModal';

export default function App() {
  // 라우팅
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['dashboard', 'payments', 'customers', 'invoices', 'settings'].includes(hash) ? hash : 'dashboard';
  });

  // 데이터
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [todayPaid, setTodayPaid] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [overdue, setOverdue] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
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

  // 라우팅: hash 변경 시 동기화
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'payments', 'customers', 'invoices', 'settings'].includes(hash)) {
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

  // 동기화
  const handleSync = async () => {
    if (syncing) return;
    if (!confirm('운영 앱 주문 → 결제 레코드 자동 생성합니다.\n\n• 운영 orders는 READ만\n• 이미 동기화된 주문은 스킵\n\n진행할까요?')) return;
    setSyncing(true); setSyncResult(null);
    try {
      const r = await supabase.syncOrdersToPaymentRecords();
      setSyncResult(r);
      await load();
    } catch (e) {
      alert('동기화 실패: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 12000);
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

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={navigate}
      isOnline={isOnline}
      todayPaid={todayPaid}
      outstanding={outstanding}
      overdueCount={overdue.length}
    >
      {currentPage === 'dashboard' && (
        <DashboardPage
          todayPaid={todayPaid}
          outstanding={outstanding}
          overdue={overdue}
          recent={recent}
          customerRanking={customerRanking}
          customers={customers}
          onOpenCustomer={(c) => setCustomerModal(c)}
          onOpenPayment={() => setPaymentModal({ open: true, customerId: null, recordId: null })}
        />
      )}

      {currentPage === 'payments' && (
        <PaymentsPage
          customers={customers}
          onOpenPayment={() => setPaymentModal({ open: true, customerId: null, recordId: null })}
          onEditHistory={(h) => setEditModal(h)}
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
