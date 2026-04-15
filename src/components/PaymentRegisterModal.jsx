import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PaymentRegisterModal({ open, onClose, onSaved, initialCustomerId, initialRecordId }) {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [records, setRecords] = useState([]);
  const [recordId, setRecordId] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);

  // 신규 레코드 입력
  const [newTotal, setNewTotal] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(todayISO());
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  // 입금 정보
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('계좌이체');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setMode('existing');
    setCustomerId(initialCustomerId ? String(initialCustomerId) : '');
    setRecords([]);
    setRecordId(initialRecordId ? String(initialRecordId) : '');
    setNewTotal(''); setNewOrderId(''); setNewInvoiceNumber(''); setNewDueDate('');
    setNewInvoiceDate(todayISO());
    setAmount(''); setMethod('계좌이체'); setMemo(''); setError('');
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    supabase.getCustomers().then(setCustomers).catch(() => setCustomers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCustomerId, initialRecordId]);

  useEffect(() => {
    if (!customerId || mode !== 'existing') { setRecords([]); return; }
    setRecordsLoading(true);
    supabase.getPaymentRecords({ customerId, hasBalance: true })
      .then((r) => {
        setRecords(r);
        // initialRecordId 있으면 유지, 없으면 첫 번째 선택
        setRecordId((prev) => {
          if (prev && r.some((x) => String(x.id) === String(prev))) return prev;
          return r[0]?.id || '';
        });
      })
      .finally(() => setRecordsLoading(false));
  }, [customerId, mode]);

  const selectedRecord = useMemo(
    () => records.find((r) => String(r.id) === String(recordId)),
    [records, recordId]
  );

  const handleSubmit = async () => {
    setError('');
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setError('입금액을 입력하세요'); return; }
    if (!customerId) { setError('업체를 선택하세요'); return; }

    setSubmitting(true);
    try {
      let targetRecordId = recordId;

      if (mode === 'new') {
        const totalNum = Number(newTotal);
        if (!totalNum || totalNum <= 0) { setError('총액을 입력하세요'); setSubmitting(false); return; }
        const newRec = await supabase.addPaymentRecord({
          order_id: newOrderId ? Number(newOrderId) : null,
          customer_id: Number(customerId),
          total_amount: totalNum,
          invoice_date: newInvoiceDate || null,
          invoice_number: newInvoiceNumber || null,
          due_date: newDueDate || null,
        });
        if (!newRec || !newRec[0]) { setError('결제 레코드 생성 실패'); setSubmitting(false); return; }
        targetRecordId = newRec[0].id;
      }

      if (!targetRecordId) { setError('주문/세금계산서를 선택하세요'); setSubmitting(false); return; }

      const saved = await supabase.addPaymentHistory({
        payment_record_id: Number(targetRecordId),
        amount: amountNum,
        method,
        memo: memo || null,
      });
      if (!saved) { setError('입금 저장 실패'); setSubmitting(false); return; }

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || '알 수 없는 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border shadow-2xl bg-[var(--card)] border-[var(--primary)]"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--card)]">
          <h3 className="text-base font-bold flex items-center gap-2">
            <span>💵</span>
            <span>입금 등록</span>
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--secondary)]" aria-label="닫기">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {/* 업체 선택 */}
          <Field label="업체" required>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
              style={{ fontSize: '16px' }}
            >
              <option value="">-- 업체 선택 --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>
              ))}
            </select>
          </Field>

          {/* 모드 전환 */}
          <div className="flex gap-1.5 text-xs">
            <ModeButton active={mode === 'existing'} onClick={() => setMode('existing')}>기존 결제에 입금</ModeButton>
            <ModeButton active={mode === 'new'} onClick={() => setMode('new')}>신규 결제 생성 + 입금</ModeButton>
          </div>

          {/* 기존 모드: 결제 레코드 선택 */}
          {mode === 'existing' && customerId && (
            <Field label="주문 / 세금계산서 (미수 있음)" required>
              {recordsLoading ? (
                <p className="text-xs text-[var(--muted-foreground)]">로딩...</p>
              ) : records.length === 0 ? (
                <p className="text-xs text-yellow-400/80 p-2 rounded-lg bg-yellow-500/10">미수 결제가 없습니다. "신규 결제 생성"을 이용하세요.</p>
              ) : (
                <select
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  style={{ fontSize: '16px' }}
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.invoice_number || r.id} · 잔 {fmt(r.balance)}원 / 총 {fmt(r.total_amount)}원
                    </option>
                  ))}
                </select>
              )}
              {selectedRecord && (
                <div className="mt-1.5 text-[11px] text-[var(--muted-foreground)] p-2 rounded bg-[var(--secondary)] space-y-0.5">
                  <div>총액: {fmt(selectedRecord.total_amount)}원 · 입금: {fmt(selectedRecord.paid_amount)}원</div>
                  <div className="font-bold text-red-400">잔금: {fmt(selectedRecord.balance)}원</div>
                </div>
              )}
            </Field>
          )}

          {/* 신규 모드: 결제 레코드 생성 필드 */}
          {mode === 'new' && (
            <>
              <Field label="총액 (세금계산서 금액)" required>
                <NumberInput value={newTotal} onChange={setNewTotal} placeholder="1000000" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="세금계산서 번호">
                  <input value={newInvoiceNumber} onChange={(e) => setNewInvoiceNumber(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" style={{ fontSize: '16px' }} placeholder="INV-xxx" />
                </Field>
                <Field label="발행일">
                  <input type="date" value={newInvoiceDate} onChange={(e) => setNewInvoiceDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" style={{ fontSize: '16px' }} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="연결 주문 ID (선택)">
                  <input value={newOrderId} onChange={(e) => setNewOrderId(e.target.value.replace(/[^0-9]/g, ''))} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" style={{ fontSize: '16px' }} placeholder="12345" />
                </Field>
                <Field label="납기일 (선택)">
                  <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" style={{ fontSize: '16px' }} />
                </Field>
              </div>
            </>
          )}

          {/* 입금 정보 */}
          <div className="pt-2 border-t border-[var(--border)] space-y-3">
            <Field label="입금액" required>
              <NumberInput value={amount} onChange={setAmount} placeholder={selectedRecord ? String(selectedRecord.balance) : '500000'} />
              {selectedRecord && amount && Number(amount) > Number(selectedRecord.balance) && (
                <p className="mt-1 text-[11px] text-orange-400">⚠️ 잔금보다 큰 금액 (초과 입금)</p>
              )}
            </Field>

            <Field label="결제 방법">
              <div className="flex gap-1.5 flex-wrap">
                {['계좌이체', '현금', '카드', '기타'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${method === m ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--secondary)] border-[var(--border)] text-[var(--muted-foreground)]'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="메모 (선택)">
              <input value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" style={{ fontSize: '16px' }} placeholder="예: 2월분 잔금 이월" />
            </Field>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="p-4 pt-0 flex gap-2 sticky bottom-0 bg-[var(--card)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg border font-semibold transition-colors ${
        active
          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
          : 'bg-[var(--secondary)] border-[var(--border)] text-[var(--muted-foreground)]'
      }`}
    >
      {children}
    </button>
  );
}

function NumberInput({ value, onChange, placeholder }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onChange(raw);
  };
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        value={value ? Number(value).toLocaleString('ko-KR') : ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm font-semibold text-right"
        style={{ fontSize: '16px' }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">원</span>
    </div>
  );
}
