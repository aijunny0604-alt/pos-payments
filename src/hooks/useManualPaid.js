import { useCallback, useEffect, useState } from 'react';

// pos-calculator-web과 localStorage 공유 (같은 오리진)
export const MANUAL_PAID_KEY = 'pos-payments.manual-paid-orders.v1';
const SYNC_EVENT = 'pos.manualPaidChanged';

export const PAYMENT_METHODS = [
  { key: 'card', label: '카드', emoji: '💳', color: '#3b82f6' },
  { key: 'cash', label: '현금', emoji: '💵', color: '#22c55e' },
  { key: 'transfer', label: '계좌이체', emoji: '🏦', color: '#a855f7' },
  { key: 'other', label: '기타', emoji: '📝', color: '#64748b' },
];
export const METHOD_MAP = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.key, m]));

export function loadManualPaid() {
  try {
    const raw = localStorage.getItem(MANUAL_PAID_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}

export function saveManualPaid(obj) {
  try { localStorage.setItem(MANUAL_PAID_KEY, JSON.stringify(obj)); } catch {}
}

function broadcast() {
  try { window.dispatchEvent(new CustomEvent(SYNC_EVENT)); } catch {}
}

export default function useManualPaid() {
  const [map, setMap] = useState(() => loadManualPaid());

  // 다른 탭(storage) + 같은 탭 다른 훅 인스턴스(CustomEvent) 동기화
  useEffect(() => {
    const sync = () => setMap(loadManualPaid());
    const onStorage = (e) => { if (e.key === MANUAL_PAID_KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SYNC_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SYNC_EVENT, sync);
    };
  }, []);

  const setPaid = useCallback((orderId, method) => {
    if (!orderId || !method) return;
    // 최신 localStorage 기준으로 머지하여 stale state 방지
    const current = loadManualPaid();
    const next = { ...current, [String(orderId)]: { method, paidAt: new Date().toISOString() } };
    saveManualPaid(next);
    setMap(next);
    broadcast();
  }, []);

  const clearPaid = useCallback((orderId) => {
    if (!orderId) return;
    const current = loadManualPaid();
    const key = String(orderId);
    if (!(key in current)) return;
    const next = { ...current };
    delete next[key];
    saveManualPaid(next);
    setMap(next);
    broadcast();
  }, []);

  const getInfo = useCallback((orderId) => map[String(orderId)] || null, [map]);

  return { map, getInfo, setPaid, clearPaid, methods: PAYMENT_METHODS, methodMap: METHOD_MAP };
}
