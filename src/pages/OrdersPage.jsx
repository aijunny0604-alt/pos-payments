import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Search, RefreshCw, FileText, Calendar, X, Eye,
  Receipt, Calculator, RotateCcw, ChevronDown, Tag, Phone, User, Wallet,
  CheckCircle2, CreditCard, Banknote, Landmark, Notebook, CircleDollarSign,
} from 'lucide-react';
import { supabase, supabaseClient } from '@/lib/supabase';
import {
  formatPrice, calcExVat, formatDateTime, formatTime,
  getTodayKST, toDateKST, offsetDateKST, offsetMonthKST,
} from '@/lib/utils';

const DATE_FILTERS = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: 'week', label: '최근 7일' },
  { key: 'month', label: '최근 1개월' },
  { key: 'custom', label: '날짜 선택' },
  { key: 'all', label: '전체' },
];

import useManualPaid, {
  MANUAL_PAID_KEY as _MPK,
  loadManualPaid as _loadMP,
  saveManualPaid as _saveMP,
  PAYMENT_METHODS as _PM,
  METHOD_MAP as _MM,
} from '@/hooks/useManualPaid';

// 기존 import 호환성 유지 (CustomerDetailModal 등 외부 컴포넌트가 사용)
export const MANUAL_PAID_KEY = _MPK;
export const loadManualPaid = _loadMP;
export const saveManualPaid = _saveMP;

// OrdersPage 내부에서는 Icon 컴포넌트가 필요하므로 Icon 포함 로컬 버전 유지
const PAYMENT_METHODS = [
  { key: 'card', label: '카드', emoji: '💳', Icon: CreditCard, color: '#3b82f6' },
  { key: 'cash', label: '현금', emoji: '💵', Icon: Banknote, color: '#22c55e' },
  { key: 'transfer', label: '계좌이체', emoji: '🏦', Icon: Landmark, color: '#a855f7' },
  { key: 'other', label: '기타', emoji: '📝', Icon: Notebook, color: '#64748b' },
];
const METHOD_MAP = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.key, m]));

export default function OrdersPage({ customers = [] }) {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]); // payment_records (for 결제 상태 뱃지)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState(getTodayKST());
  const [priceTypeFilter, setPriceTypeFilter] = useState('all'); // all | wholesale | consumer
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | paid | unpaid | unsynced | manual
  const [detail, setDetail] = useState(null); // 선택 주문
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // 수동 완불 — 공용 훅 사용 (storage + CustomEvent 동기화, stale state 방지)
  const { map: manualPaid, setPaid: _setPaid, clearPaid } = useManualPaid();
  const [methodPicker, setMethodPicker] = useState(null); // 결제수단 선택창 열린 주문 id
  const setPaid = (id, method) => { _setPaid(id, method); setMethodPicker(null); };

  const load = async () => {
    setRefreshing(true);
    try {
      const [raw, pr] = await Promise.all([
        supabase.getOrders(),
        supabase.getPaymentRecords ? supabase.getPaymentRecords({}) : Promise.resolve([]),
      ]);
      setOrders(Array.isArray(raw) ? raw : []);
      setPayments(Array.isArray(pr) ? pr : []);
    } catch (e) {
      console.error('OrdersPage load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 실시간 구독
  useEffect(() => {
    const ch = supabaseClient
      .channel('pos-payments-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records' }, () => load())
      .subscribe();
    return () => { supabaseClient.removeChannel(ch); };
  }, []);

  // 주문ID → 결제 레코드 인덱스
  const paymentByOrderId = useMemo(() => {
    const m = new Map();
    for (const p of payments) {
      if (p.order_id) m.set(String(p.order_id), p);
    }
    return m;
  }, [payments]);

  const customerByName = useMemo(() => {
    const m = new Map();
    for (const c of customers) {
      if (c?.name) m.set(c.name.toLowerCase().replace(/\s/g, ''), c);
    }
    return m;
  }, [customers]);

  const filterByDate = (order) => {
    if (dateFilter === 'all') return true;
    if (!order.created_at) return false;
    const d = toDateKST(order.created_at);
    const today = getTodayKST();
    if (dateFilter === 'today') return d === today;
    if (dateFilter === 'yesterday') return d === offsetDateKST(today, -1);
    if (dateFilter === 'week') return d >= offsetDateKST(today, -7);
    if (dateFilter === 'month') return d >= offsetMonthKST(today, -1);
    if (dateFilter === 'custom') return customDate && d === customDate;
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s/g, '');
    return orders.filter(filterByDate).filter((o) => {
      if (priceTypeFilter !== 'all' && o.price_type !== priceTypeFilter) return false;
      if (paymentFilter !== 'all') {
        const pr = paymentByOrderId.get(String(o.id));
        const isManual = !!manualPaid[o.id];
        if (paymentFilter === 'manual' && !isManual) return false;
        if (paymentFilter === 'unsynced' && pr) return false;
        if (paymentFilter === 'paid' && !(isManual || (pr && pr.payment_status === 'paid'))) return false;
        if (paymentFilter === 'unpaid') {
          if (isManual) return false;
          if (!pr || pr.payment_status === 'paid') return false;
        }
      }
      if (!q) return true;
      const id = String(o.id || '').toLowerCase();
      const name = (o.customer_name || '').toLowerCase().replace(/\s/g, '');
      const phone = (o.customer_phone || '').replace(/[\s-]/g, '');
      const memo = (o.memo || '').toLowerCase().replace(/\s/g, '');
      const items = (o.items || []).map((i) => (i.name || '').toLowerCase().replace(/\s/g, '')).join(' ');
      return id.includes(q) || name.includes(q) || phone.includes(q) || memo.includes(q) || items.includes(q);
    });
  }, [orders, dateFilter, customDate, search, priceTypeFilter, paymentFilter, paymentByOrderId, manualPaid]);

  // 집계
  const stats = useMemo(() => {
    const total = filtered.reduce((s, o) => s + Number(o.total || o.total_amount || 0), 0);
    const returned = filtered.reduce((s, o) => s + Number(o.total_returned || 0), 0);
    const net = total - returned;
    const supply = calcExVat(net);
    const vat = net - supply;
    let paidCount = 0, unpaidCount = 0, unsyncedCount = 0, manualCount = 0;
    const methodAgg = { card: 0, cash: 0, transfer: 0, other: 0 };
    for (const o of filtered) {
      const pr = paymentByOrderId.get(String(o.id));
      const manual = manualPaid[o.id];
      if (manual) {
        manualCount++;
        const amt = Number(o.total || o.total_amount || 0) - Number(o.total_returned || 0);
        if (methodAgg[manual.method] !== undefined) methodAgg[manual.method] += amt;
      }
      if (!pr) unsyncedCount++;
      else if (pr.payment_status === 'paid') paidCount++;
      else unpaidCount++;
    }
    return { total, returned, net, supply, vat, paidCount, unpaidCount, unsyncedCount, manualCount, methodAgg };
  }, [filtered, paymentByOrderId, manualPaid]);

  const filterLabel = () => DATE_FILTERS.find((f) => f.key === dateFilter)?.label || '전체';

  const openDetail = (o) => setDetail(o);
  const closeDetail = () => setDetail(null);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-2 pb-3 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold">주문 내역</h1>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                전체 {orders.length}건 · 필터 {filtered.length}건
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={load}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-[var(--accent)] disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setCollapsed((p) => !p)}
              className="px-2 py-2 rounded-lg hover:bg-[var(--accent)] text-xs flex items-center gap-1"
            >
              <span className="hidden sm:inline">{collapsed ? '펼치기' : '접기'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* 날짜 필터 (항상) */}
        <div className="flex flex-wrap gap-1.5">
          {DATE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: dateFilter === key ? 'var(--primary)' : 'var(--muted)',
                color: dateFilter === key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {label}
            </button>
          ))}
          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs bg-[var(--background)] border-[var(--border)]"
            />
          )}
        </div>

        {/* 집계 요약 (접힘 상태) */}
        {collapsed && (
          <div className="mt-2 text-xs rounded-lg px-3 py-2 bg-[var(--muted)] flex items-center justify-between">
            <span className="text-[var(--muted-foreground)]">
              {filterLabel()} · {filtered.length}건
            </span>
            <span className="font-semibold text-emerald-400">
              {formatPrice(stats.net)}원
            </span>
          </div>
        )}

        {/* 확장 영역 */}
        <div className={`overflow-hidden transition-all ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[700px] opacity-100 mt-3'}`}>
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <StatCard icon={FileText} label={dateFilter === 'all' ? '총 주문' : '조회 주문'} value={`${filtered.length}건`} />
            <StatCard icon={Calculator} label="매출(반품차감)" value={`${formatPrice(stats.net)}원`} color="var(--success, #22c55e)" />
            <StatCard icon={Receipt} label="공급가액" value={`${formatPrice(stats.supply)}원`} color="var(--primary)" />
            <StatCard icon={Receipt} label="부가세 10%" value={`${formatPrice(stats.vat)}원`} color="#a78bfa" />
          </div>

          {/* 결제 상태 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <StatusPill label="✅ 결제완료" value={`${stats.paidCount}건`} active={paymentFilter === 'paid'} onClick={() => setPaymentFilter((p) => (p === 'paid' ? 'all' : 'paid'))} color="#22c55e" />
            <StatusPill label="💰 수동 완불" value={`${stats.manualCount}건`} active={paymentFilter === 'manual'} onClick={() => setPaymentFilter((p) => (p === 'manual' ? 'all' : 'manual'))} color="#10b981" />
            <StatusPill label="⏳ 미수" value={`${stats.unpaidCount}건`} active={paymentFilter === 'unpaid'} onClick={() => setPaymentFilter((p) => (p === 'unpaid' ? 'all' : 'unpaid'))} color="#f59e0b" />
            <StatusPill label="📥 미동기화" value={`${stats.unsyncedCount}건`} active={paymentFilter === 'unsynced'} onClick={() => setPaymentFilter((p) => (p === 'unsynced' ? 'all' : 'unsynced'))} color="#64748b" />
          </div>

          {/* 결제수단별 합계 (수동 완불 집계) */}
          {stats.manualCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.key}
                  className="rounded-lg px-2 py-1.5 border text-[11px] flex items-center gap-1.5"
                  style={{
                    background: stats.methodAgg[m.key] > 0 ? `color-mix(in srgb, ${m.color} 10%, var(--card))` : 'var(--card)',
                    borderColor: stats.methodAgg[m.key] > 0 ? `color-mix(in srgb, ${m.color} 40%, var(--border))` : 'var(--border)',
                  }}
                >
                  <span>{m.emoji}</span>
                  <span className="text-[var(--muted-foreground)] flex-shrink-0">{m.label}</span>
                  <span className="ml-auto font-semibold" style={{ color: stats.methodAgg[m.key] > 0 ? m.color : 'var(--muted-foreground)' }}>
                    {formatPrice(stats.methodAgg[m.key])}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 가격 타입 필터 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[{ k: 'all', l: '전체' }, { k: 'wholesale', l: '도매' }, { k: 'consumer', l: '소비자' }].map(({ k, l }) => (
              <button
                key={k}
                onClick={() => setPriceTypeFilter(k)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  background: priceTypeFilter === k ? 'var(--primary)' : 'transparent',
                  color: priceTypeFilter === k ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  borderColor: priceTypeFilter === k ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <Tag className="w-3 h-3 inline mr-1" />{l}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="주문번호, 고객명, 연락처, 제품명, 메모"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-lg border text-sm bg-[var(--background)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--accent)]"
              >
                <X className="w-4 h-4 text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders grid */}
      <div className="pt-4">
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">불러오는 중...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <ShoppingCart className="w-14 h-14 mb-3 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {orders.length === 0 ? '저장된 주문 내역이 없습니다' : '조건에 맞는 주문이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                payment={paymentByOrderId.get(String(o.id))}
                customer={customerByName.get((o.customer_name || '').toLowerCase().replace(/\s/g, ''))}
                manualInfo={manualPaid[o.id] || null}
                pickerOpen={methodPicker === o.id}
                onOpen={() => openDetail(o)}
                onOpenPicker={() => setMethodPicker((p) => (p === o.id ? null : o.id))}
                onSelectMethod={(key) => setPaid(o.id, key)}
                onClearPaid={() => clearPaid(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {detail && (
        <OrderDetailModal
          order={detail}
          payment={paymentByOrderId.get(String(detail.id))}
          customer={customerByName.get((detail.customer_name || '').toLowerCase().replace(/\s/g, ''))}
          manualInfo={manualPaid[detail.id] || null}
          onSelectMethod={(key) => setPaid(detail.id, key)}
          onClearPaid={() => clearPaid(detail.id)}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-3 border bg-[var(--card)] border-[var(--border)]">
      <p className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="font-bold text-sm sm:text-base break-all leading-tight" style={{ color: color || 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ label, value, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-2 py-2 border text-left transition-colors text-[11px]"
      style={{
        background: active ? `color-mix(in srgb, ${color} 15%, var(--card))` : 'var(--card)',
        borderColor: active ? color : 'var(--border)',
      }}
    >
      <div className="text-[10px] text-[var(--muted-foreground)]">{label}</div>
      <div className="font-bold text-sm" style={{ color: active ? color : 'var(--foreground)' }}>
        {value}
      </div>
    </button>
  );
}

export function PaymentBadge({ payment }) {
  if (!payment) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
        미동기화
      </span>
    );
  }
  const status = payment.payment_status;
  if (status === 'paid') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        ✓ 결제완료
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        부분입금
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
      미수
    </span>
  );
}

function OrderCard({ order, payment, customer, manualInfo, pickerOpen, onOpen, onOpenPicker, onSelectMethod, onClearPaid }) {
  const items = order.items || [];
  const qtySum = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const total = Number(order.total || order.total_amount || 0);
  const returned = Number(order.total_returned || 0);
  const isBlacklist = customer?.is_blacklist;
  const isPaid = !!manualInfo;
  const method = isPaid ? METHOD_MAP[manualInfo.method] : null;

  return (
    <div
      className="text-left rounded-xl p-4 border relative overflow-hidden transition-colors"
      style={{
        background: isPaid
          ? 'color-mix(in srgb, #10b981 10%, var(--card))'
          : isBlacklist
            ? 'color-mix(in srgb, var(--destructive) 6%, var(--card))'
            : 'var(--card)',
        borderColor: isPaid
          ? '#10b981'
          : isBlacklist
            ? 'var(--destructive)'
            : 'var(--border)',
        boxShadow: isPaid ? '0 0 0 1px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(16, 185, 129, 0.12)' : 'none',
      }}
    >
      {/* 상단 액센트 바 */}
      {isPaid ? (
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
      ) : isBlacklist ? (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
      ) : null}

      {/* 완불 리본 */}
      {isPaid && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md"
          style={{ background: '#10b981', color: 'white' }}
        >
          <CheckCircle2 className="w-3 h-3" />
          완불 {method?.emoji}
        </div>
      )}

      <button
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="flex items-start justify-between gap-2 mb-2" style={{ paddingRight: isPaid ? '72px' : '0' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-base flex-shrink-0">{isBlacklist ? '🚫' : '👤'}</span>
              <span
                className="font-bold text-sm sm:text-base break-keep leading-snug min-w-0"
                style={{ color: isBlacklist ? 'var(--destructive)' : 'var(--foreground)' }}
              >
                {order.customer_name || '고객 미지정'}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                style={{
                  background: order.price_type === 'wholesale' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                  color: order.price_type === 'wholesale' ? '#60a5fa' : '#c084fc',
                }}
              >
                {order.price_type === 'wholesale' ? '도매' : '소비자'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--muted-foreground)]">
              <span className="truncate">{String(order.id).replace(/^ORD-/, '')}</span>
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <Calendar className="w-3 h-3" />
                {formatDateTime(order.created_at)}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p
              className="font-bold text-lg sm:text-xl leading-tight"
              style={{ color: isPaid ? '#059669' : '#10b981' }}
            >
              {formatPrice(total - returned)}원
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
              공급가 {formatPrice(calcExVat(total - returned))}원
            </p>
          </div>
        </div>

        <div className="rounded-lg p-2 mb-2 bg-[var(--muted)]">
          <p className="text-[11px] break-keep leading-snug">
            {items.slice(0, 3).map((it, i) => (
              <span key={i}>
                {it.name}<span className="text-[var(--muted-foreground)]">({it.quantity})</span>{i < Math.min(items.length - 1, 2) ? ', ' : ''}
              </span>
            ))}
            {items.length > 3 && (
              <span className="text-[var(--muted-foreground)]"> 외 {items.length - 3}건</span>
            )}
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            {items.length}종 / {qtySum}개
          </p>
        </div>

        {returned > 0 && (
          <div className="text-[11px] px-2 py-1 rounded mb-1.5 flex items-center gap-1 bg-amber-500/10 text-amber-400">
            <RotateCcw className="w-3 h-3" />
            반품 -{formatPrice(returned)}원
          </div>
        )}

        {order.memo && (
          <div className="text-[11px] px-2 py-1 rounded mb-1.5 flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="break-keep leading-snug line-clamp-2">{order.memo}</span>
          </div>
        )}
      </button>

      {/* 완불 상세 배너 (수동 체크된 경우) */}
      {isPaid && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 mb-2 border text-[11px]"
          style={{
            background: 'color-mix(in srgb, #10b981 14%, transparent)',
            borderColor: 'color-mix(in srgb, #10b981 40%, var(--border))',
          }}
        >
          <span className="font-semibold flex items-center gap-1" style={{ color: '#059669' }}>
            {method?.emoji} {method?.label} 결제
          </span>
          <span className="text-[var(--muted-foreground)]">
            {formatDateTime(manualInfo.paidAt)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PaymentBadge payment={payment} />
          {payment && !isPaid && Number(payment.balance) > 0 && (
            <span className="text-[11px] text-orange-400 font-semibold">
              잔금 {formatPrice(payment.balance)}원
            </span>
          )}
        </div>

        {/* 완불 액션 */}
        {isPaid ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
              className="px-2 py-1 rounded-md text-[11px] font-medium border"
              style={{
                borderColor: 'color-mix(in srgb, #10b981 40%, var(--border))',
                color: '#059669',
                background: 'color-mix(in srgb, #10b981 8%, transparent)',
              }}
            >
              수단 변경
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClearPaid(); }}
              className="px-2 py-1 rounded-md text-[11px] font-medium border text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              style={{ borderColor: 'var(--border)' }}
              title="완불 해제"
            >
              해제
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-colors hover:bg-emerald-500/10"
            style={{ borderColor: '#10b981', color: '#10b981' }}
          >
            <CircleDollarSign className="w-3.5 h-3.5" />
            완불 체크
          </button>
        )}
      </div>

      {/* 결제수단 선택 인라인 패널 */}
      {pickerOpen && (
        <div
          className="mt-2 p-2 rounded-lg border"
          style={{
            background: 'color-mix(in srgb, #10b981 6%, var(--card))',
            borderColor: 'color-mix(in srgb, #10b981 35%, var(--border))',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-[var(--muted-foreground)] mb-1.5">결제 수단 선택</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHODS.map((m) => {
              const selected = manualInfo?.method === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => onSelectMethod(m.key)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors"
                  style={{
                    background: selected ? m.color : 'var(--card)',
                    color: selected ? 'white' : m.color,
                    borderColor: selected ? m.color : `color-mix(in srgb, ${m.color} 30%, var(--border))`,
                  }}
                >
                  <span>{m.emoji}</span>
                  {m.label}
                  {selected && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrderDetailModal({ order, payment, customer, manualInfo, onSelectMethod, onClearPaid, onClose }) {
  const items = order.items || [];
  const total = Number(order.total || order.total_amount || 0);
  const returned = Number(order.total_returned || 0);
  const net = total - returned;
  const supply = calcExVat(net);
  const vat = net - supply;
  const isPaid = !!manualInfo;
  const method = isPaid ? METHOD_MAP[manualInfo.method] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border bg-[var(--card)] border-[var(--border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold">주문 상세</h3>
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">{order.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--accent)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* 고객 */}
          <div className="rounded-xl p-3 border border-[var(--border)] bg-[var(--muted)]">
            <p className="text-[10px] text-[var(--muted-foreground)] mb-1">고객 정보</p>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-[var(--muted-foreground)]" />
              <span className="font-bold text-sm break-keep">
                {order.customer_name || '고객 미지정'}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: order.price_type === 'wholesale' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                  color: order.price_type === 'wholesale' ? '#60a5fa' : '#c084fc',
                }}
              >
                {order.price_type === 'wholesale' ? '도매' : '소비자'}
              </span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Phone className="w-3 h-3" />
                {order.customer_phone}
              </div>
            )}
            {customer?.address && (
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5 break-keep leading-snug">
                📍 {customer.address}
              </div>
            )}
          </div>

          {/* 결제 상태 */}
          <div
            className="rounded-xl p-3 border"
            style={{
              borderColor: isPaid ? '#10b981' : 'var(--border)',
              background: isPaid ? 'color-mix(in srgb, #10b981 8%, var(--card))' : 'transparent',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                결제 상태
              </p>
              <PaymentBadge payment={payment} />
            </div>
            {payment ? (
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">청구</div>
                  <div className="font-bold text-sm">{formatPrice(payment.total_amount)}원</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">입금</div>
                  <div className="font-bold text-sm text-emerald-400">{formatPrice(payment.paid_amount)}원</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">잔금</div>
                  <div className="font-bold text-sm text-orange-400">{formatPrice(payment.balance)}원</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                결제 레코드가 아직 생성되지 않았습니다. 설정 → 동기화 실행 시 자동 생성됩니다.
              </p>
            )}

            {/* 수동 완불 체크 영역 */}
            <div className="pt-2 mt-1 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: isPaid ? '#059669' : 'var(--foreground)' }}>
                  <CircleDollarSign className="w-3.5 h-3.5" />
                  수동 완불 체크
                </p>
                {isPaid && (
                  <button
                    onClick={onClearPaid}
                    className="text-[11px] px-2 py-0.5 rounded border text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    해제
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const selected = manualInfo?.method === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => onSelectMethod(m.key)}
                      className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-md text-xs font-medium border transition-colors"
                      style={{
                        background: selected ? m.color : 'var(--card)',
                        color: selected ? 'white' : m.color,
                        borderColor: selected ? m.color : `color-mix(in srgb, ${m.color} 30%, var(--border))`,
                      }}
                    >
                      <span className="text-base leading-none">{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              {isPaid && (
                <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                  <span className="font-semibold" style={{ color: '#059669' }}>{method?.emoji} {method?.label} 결제</span>
                  {' · '}{formatDateTime(manualInfo.paidAt)}
                </p>
              )}
            </div>
          </div>

          {/* 품목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">품목 ({items.length}종 / {items.reduce((s, i) => s + Number(i.quantity || 0), 0)}개)</p>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {formatTime(order.created_at)}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 text-xs"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-keep leading-snug">{it.name}</div>
                    {it.note && (
                      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 break-keep">
                        📝 {it.note}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[var(--muted-foreground)]">
                      {formatPrice(it.price || it.unit_price || 0)}원 × {it.quantity}
                    </div>
                    <div className="font-semibold mt-0.5">
                      {formatPrice((Number(it.price || it.unit_price || 0)) * Number(it.quantity || 0))}원
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 합계 */}
          <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--muted-foreground)]">
              <span>공급가액</span>
              <span>{formatPrice(supply)}원</span>
            </div>
            <div className="flex justify-between text-[var(--muted-foreground)]">
              <span>부가세 10%</span>
              <span>{formatPrice(vat)}원</span>
            </div>
            {returned > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>반품 차감</span>
                <span>-{formatPrice(returned)}원</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-emerald-500/30">
              <span>합계</span>
              <span className="text-emerald-400">{formatPrice(net)}원</span>
            </div>
          </div>

          {/* 메모 */}
          {order.memo && (
            <div className="rounded-xl p-3 border border-sky-500/30 bg-sky-500/5">
              <p className="text-[10px] text-sky-400 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                메모
              </p>
              <p className="text-xs break-keep leading-snug">{order.memo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
