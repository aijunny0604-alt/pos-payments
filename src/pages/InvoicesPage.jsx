import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toPng, toBlob } from 'html-to-image';
import { Printer, Download, Copy } from 'lucide-react';
import { DEFAULT_CATEGORIES, getCategoryInfo } from '@/lib/vatHelper';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function InvoicesPage({ customers }) {
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState('all');
  const [records, setRecords] = useState([]);
  const [carryover, setCarryover] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState(null);
  const invoiceRef = useRef(null);
  const categories = settings?.expense_categories || DEFAULT_CATEGORIES;

  useEffect(() => {
    supabase.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    setLoading(true);
    const filters = { invoiceDate: date };
    if (customerId !== 'all') filters.customerId = customerId;
    Promise.all([
      supabase.getPaymentRecords(filters),
      // 전월 이월: 선택일 이전의 모든 미수
      supabase.getPaymentRecords({ ...(customerId !== 'all' && { customerId }), hasBalance: true })
        .then((all) => all.filter((r) => (r.invoice_date || '') < date)),
    ]).then(([r, prev]) => { setRecords(r); setCarryover(prev); }).finally(() => setLoading(false));
  }, [date, customerId]);

  const customerName = (id) => customers.find((c) => c.id === id)?.name || `#${id}`;

  const summary = useMemo(() => {
    const total = records.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const supply = records.reduce((s, r) => s + Number(r.supply_amount || r.total_amount || 0), 0);
    const vat = records.reduce((s, r) => s + Number(r.vat_amount || 0), 0);
    const paid = records.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const balance = records.reduce((s, r) => s + Number(r.balance || 0), 0);
    return { total, supply, vat, paid, balance, count: records.length };
  }, [records]);

  const carryoverTotal = useMemo(
    () => carryover.reduce((s, r) => s + Number(r.balance || 0), 0),
    [carryover]
  );

  const grandTotal = carryoverTotal + summary.balance;

  const grouped = useMemo(() => {
    if (customerId !== 'all') return null;
    const g = new Map();
    for (const r of records) {
      const key = r.customer_id || 0;
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(r);
    }
    return [...g.entries()].map(([id, rows]) => ({
      id, name: customerName(id), rows,
      total: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      balance: rows.reduce((s, r) => s + Number(r.balance || 0), 0),
    }));
  }, [records, customerId, customers]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handlePng = async () => {
    if (!invoiceRef.current) return;
    try {
      const dataUrl = await toPng(invoiceRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `명세서_${customerId === 'all' ? '전체' : (customerName(customerId) || '').replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${date}.png`;
      a.click();
      showToast('✅ PNG 다운로드됨');
    } catch (e) { showToast('PNG 실패: ' + e.message); }
  };

  const handleCopy = async () => {
    if (!invoiceRef.current) return;
    try {
      const blob = await toBlob(invoiceRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('blob 생성 실패');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('✅ 클립보드 복사됨 — 카톡에 붙여넣기');
    } catch (e) { showToast('복사 실패: ' + e.message); }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-print, .invoice-print * { visibility: visible; }
          .invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-2 no-print">
        <h2 className="text-base font-bold">📄 명세서 발행</h2>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 no-print">
        <div>
          <label className="block text-[10px] font-semibold mb-1 text-[var(--muted-foreground)]">세금계산서 발행일</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            style={{ fontSize: '16px' }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-1 text-[var(--muted-foreground)]">업체</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            style={{ fontSize: '16px' }}
          >
            <option value="all">전체 업체 (그룹별)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
          </select>
        </div>
      </div>

      {/* 액션 */}
      <div className="grid grid-cols-3 gap-2 no-print">
        <ActionBtn icon={Printer} onClick={handlePrint} variant="default">인쇄</ActionBtn>
        <ActionBtn icon={Download} onClick={handlePng} variant="primary">PNG</ActionBtn>
        <ActionBtn icon={Copy} onClick={handleCopy} variant="success">복사</ActionBtn>
      </div>

      {/* 명세서 미리보기 */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <div
          ref={invoiceRef}
          className="invoice-print bg-white text-black p-5"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          <header className="border-b-2 border-black pb-3 mb-3">
            <h1 className="text-xl font-bold">{settings?.company_name || 'MOVE MOTORS'}</h1>
            {settings?.business_number && <p className="text-[10px] text-gray-600">사업자: {settings.business_number}</p>}
            {settings?.company_phone && <p className="text-[10px] text-gray-600">{settings.company_phone}</p>}
            {settings?.company_address && <p className="text-[10px] text-gray-600 break-keep">{settings.company_address}</p>}
            <p className="text-xs text-gray-600 mt-2">
              {customerId === 'all' ? `${date} 발송 내역 — 전체 업체` : `${customerName(customerId)} 귀하`}
            </p>
            <p className="text-xs text-gray-600">발행일: {date}</p>
          </header>

          {loading ? (
            <p className="text-sm text-center py-6">로딩 중...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-center py-6 text-gray-600">해당 일자의 발행 내역이 없습니다.</p>
          ) : (
            <>
              {grouped ? grouped.map((g) => (
                <section key={g.id} className="mb-4">
                  <h2 className="text-sm font-bold mb-1.5 border-b border-gray-300 pb-1">🏢 {g.name}</h2>
                  <InvoiceTable rows={g.rows} categories={categories} />
                  <p className="text-xs text-right mt-1">
                    소계: 총 {fmt(g.total)}원 / 미수 <strong className="text-red-600">{fmt(g.balance)}원</strong>
                  </p>
                </section>
              )) : (
                <InvoiceTable rows={records} categories={categories} />
              )}

              {/* 전월 이월 */}
              {carryoverTotal > 0 && (
                <section className="mt-3 p-2 bg-gray-100 rounded text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>📅 전월 이월 미수 ({carryover.length}건)</span>
                    <span className="text-red-600">{fmt(carryoverTotal)}원</span>
                  </div>
                </section>
              )}

              <section className="mt-3 pt-3 border-t-2 border-black space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span>발행 건수:</span><span className="font-bold">{summary.count}건</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>공급가액 합계:</span><span className="font-bold">{fmt(summary.supply)}원</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>부가세 합계:</span><span className="font-bold text-orange-700">{fmt(summary.vat)}원</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                  <span className="font-semibold">당일 합계 (공급+VAT):</span><span className="font-bold">{fmt(summary.total)}원</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>당일 입금:</span><span className="font-bold text-green-700">{fmt(summary.paid)}원</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>당일 미수:</span><span className="font-bold text-red-600">{fmt(summary.balance)}원</span>
                </div>
                {carryoverTotal > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>+ 전월 이월:</span><span className="font-bold text-red-600">{fmt(carryoverTotal)}원</span>
                  </div>
                )}
                <div className="flex justify-between text-base mt-2 pt-2 border-t-2 border-black bg-yellow-50 px-2 py-1.5 rounded">
                  <span className="font-bold">💰 총 미수 (이월 포함):</span>
                  <span className="font-bold text-red-600 text-lg">{fmt(grandTotal)}원</span>
                </div>
              </section>

              <footer className="mt-4 pt-3 border-t border-gray-300 text-xs text-gray-600 space-y-0.5">
                {settings?.bank_account && <p className="font-semibold">💳 입금 계좌: {settings.bank_account}</p>}
                {settings?.invoice_footer && <p className="break-keep">{settings.invoice_footer}</p>}
                <p>문의: {settings?.company_name || 'MOVE MOTORS'} {settings?.company_phone && `· ${settings.company_phone}`}</p>
              </footer>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black text-white text-xs font-semibold shadow-2xl z-50 no-print">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, onClick, children, variant }) {
  const map = {
    default: 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]',
    primary: 'bg-[var(--primary)] text-white',
    success: 'bg-green-600 text-white',
  };
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold ${map[variant]}`}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function InvoiceTable({ rows, categories = DEFAULT_CATEGORIES }) {
  return (
    <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr className="border-b border-gray-400 bg-gray-50">
          <th className="text-left py-1.5 px-1">세금계산서</th>
          <th className="text-left py-1.5 px-1">구분</th>
          <th className="text-right py-1.5 px-1">공급가</th>
          <th className="text-right py-1.5 px-1">부가세</th>
          <th className="text-right py-1.5 px-1 font-bold">합계</th>
          <th className="text-right py-1.5 px-1">입금</th>
          <th className="text-right py-1.5 px-1">잔금</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const cat = getCategoryInfo(categories, r.category);
          return (
            <tr key={r.id} className="border-b border-gray-200">
              <td className="py-1.5 px-1">
                <div className="font-semibold">{r.invoice_number || `#${r.id}`}</div>
                {r.order_id && <div className="text-[9px] text-gray-500">주문 #{r.order_id}</div>}
                {r.invoice_issued && <div className="text-[9px] text-green-700">✅ 발행</div>}
              </td>
              <td className="py-1.5 px-1">
                <div className="text-[10px]">{cat.icon} {cat.label}</div>
                {r.is_vat_exempt && <div className="text-[9px] text-blue-600">비과세</div>}
              </td>
              <td className="text-right py-1.5 px-1">{fmt(r.supply_amount || r.total_amount)}</td>
              <td className="text-right py-1.5 px-1 text-orange-700">
                {r.is_vat_exempt ? '-' : fmt(r.vat_amount)}
              </td>
              <td className="text-right py-1.5 px-1 font-bold">{fmt(r.total_amount)}</td>
              <td className="text-right py-1.5 px-1 text-green-700">{fmt(r.paid_amount)}</td>
              <td className="text-right py-1.5 px-1 text-red-600 font-bold">{fmt(r.balance)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
