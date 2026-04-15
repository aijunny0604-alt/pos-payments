import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Database, FileSpreadsheet, AlertTriangle, CheckCircle2, Building, Lock, Hash, Save } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SettingsPage({
  customers, recordsCount, syncing, syncResult, exporting,
  onSync, onExport, onRefresh,
}) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinSet, setPinSet] = useState(false);

  useEffect(() => {
    supabase.getSettings().then((s) => {
      setSettings(s);
      setPinSet(!!s?.pin_hash);
    });
  }, []);

  const updateField = (field, value) => {
    setSettings((s) => ({ ...s, [field]: value }));
  };

  const showToast = (msg) => { setSavedToast(msg); setTimeout(() => setSavedToast(''), 2500); };

  const handleSaveCompany = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await supabase.updateSettings({
        company_name: settings.company_name,
        business_number: settings.business_number,
        company_address: settings.company_address,
        company_phone: settings.company_phone,
        bank_account: settings.bank_account,
        invoice_footer: settings.invoice_footer,
        invoice_prefix: settings.invoice_prefix,
      });
      showToast('✅ 회사 정보 저장됨');
    } catch (e) { showToast('저장 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleSetPin = async () => {
    if (newPin.trim().length < 4) { showToast('비밀번호는 4자 이상'); return; }
    setSaving(true);
    try {
      const hash = await sha256(newPin);
      await supabase.updateSettings({ pin_hash: hash, pin_required: true });
      setSettings((s) => ({ ...s, pin_hash: hash, pin_required: true }));
      setPinSet(true);
      setNewPin('');
      showToast('✅ 비밀번호 설정됨 (다음 접속부터 적용)');
    } catch (e) { showToast('설정 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDisablePin = async () => {
    if (!confirm('비밀번호 인증을 해제하시겠습니까?')) return;
    setSaving(true);
    try {
      await supabase.updateSettings({ pin_required: false });
      setSettings((s) => ({ ...s, pin_required: false }));
      showToast('✅ 비밀번호 인증 해제됨');
    } catch (e) { showToast('해제 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  if (!settings) return <div className="text-center py-8 text-sm">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">
      <h2 className="text-base font-bold">설정</h2>

      {/* 회사 정보 */}
      <Section title="🏢 회사 정보 (명세서에 표시)" icon={Building}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="회사명">
            <input
              value={settings.company_name || ''}
              onChange={(e) => updateField('company_name', e.target.value)}
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="사업자 번호">
            <input
              value={settings.business_number || ''}
              onChange={(e) => updateField('business_number', e.target.value)}
              placeholder="000-00-00000"
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="전화" >
            <input
              value={settings.company_phone || ''}
              onChange={(e) => updateField('company_phone', e.target.value)}
              placeholder="010-XXXX-XXXX"
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="입금 계좌">
            <input
              value={settings.bank_account || ''}
              onChange={(e) => updateField('bank_account', e.target.value)}
              placeholder="기업 000-000000-00-000 (예금주)"
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="주소" wide>
            <input
              value={settings.company_address || ''}
              onChange={(e) => updateField('company_address', e.target.value)}
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="명세서 푸터 메시지" wide>
            <input
              value={settings.invoice_footer || ''}
              onChange={(e) => updateField('invoice_footer', e.target.value)}
              placeholder="입금 확인 부탁드립니다."
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
        </div>
        <button
          onClick={handleSaveCompany}
          disabled={saving}
          className="mt-3 w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" /> 회사 정보 저장
        </button>
      </Section>

      {/* 자동 채번 */}
      <Section title="🔢 세금계산서 자동 채번" icon={Hash}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prefix">
            <input
              value={settings.invoice_prefix || 'INV'}
              onChange={(e) => updateField('invoice_prefix', e.target.value)}
              className="input"
              style={{ fontSize: '16px' }}
            />
          </Field>
          <Field label="현재 시퀀스">
            <input
              value={settings.invoice_seq}
              disabled
              className="input opacity-60"
            />
          </Field>
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-2 break-all">
          예시: <strong>{settings.invoice_prefix || 'INV'}-{new Date().getFullYear()}-{String((settings.invoice_seq || 0) + 1).padStart(4, '0')}</strong>
        </p>
        <button
          onClick={handleSaveCompany}
          disabled={saving}
          className="mt-2 w-full py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-semibold"
        >
          Prefix 저장
        </button>
      </Section>

      {/* 비밀번호 인증 */}
      <Section title="🔐 비밀번호 인증" icon={Lock} variant={pinSet && settings.pin_required ? 'success' : 'warning'}>
        <div className="text-xs space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5">
            {settings.pin_required ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> <span>인증 활성 — 다음 접속 시 비밀번호 필요</span></>
            ) : (
              <><AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> <span>인증 비활성 — 누구나 접속 가능</span></>
            )}
          </div>
        </div>
        <Field label="새 비밀번호 (4자 이상)">
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="••••"
            className="input"
            style={{ fontSize: '16px' }}
          />
        </Field>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSetPin}
            disabled={saving || newPin.length < 4}
            className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-bold disabled:opacity-50"
          >
            {pinSet ? '🔄 비번 변경' : '🔐 비번 설정'}
          </button>
          {settings.pin_required && (
            <button
              onClick={handleDisablePin}
              className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-bold"
            >
              인증 해제
            </button>
          )}
        </div>
      </Section>

      {/* 시스템 상태 */}
      <Section title="🔌 시스템 상태" icon={Database}>
        <Stat label="Supabase 연결" value="✅ 정상" />
        <Stat label="고객 데이터" value={`${fmt(customers.length)}명`} />
        <Stat label="등록된 결제 레코드" value={`${fmt(recordsCount)}건`} />
      </Section>

      {/* 동기화 */}
      <Section title="🔄 운영 주문 동기화" icon={RefreshCw}>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-3">
          운영 앱 주문을 결제 레코드로 자동 변환. 운영 DB 무영향.
        </p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="w-full py-3 rounded-lg text-sm font-bold border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] disabled:opacity-50"
        >
          {syncing ? '⟳ 동기화 중...' : '🔄 지금 동기화'}
        </button>
        {syncResult && (
          <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300">
            ✅ {syncResult.total}건 중 <strong>{syncResult.inserted}건 신규</strong>
          </div>
        )}
      </Section>

      {/* Excel + 새로고침 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onExport}
          disabled={exporting}
          className="py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-bold disabled:opacity-50 flex flex-col items-center gap-1"
        >
          <FileSpreadsheet className="w-5 h-5" />
          {exporting ? '생성중...' : 'Excel 다운로드'}
        </button>
        <button
          onClick={onRefresh}
          className="py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-bold flex flex-col items-center gap-1"
        >
          <RefreshCw className="w-5 h-5" />
          데이터 새로고침
        </button>
      </div>

      {/* 버전 */}
      <div className="text-center text-[10px] text-[var(--muted-foreground)] py-3">
        pos-payments v3.0.0-beta · build {new Date().toISOString().slice(0, 10)}
      </div>

      {/* 토스트 */}
      {savedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black text-white text-xs font-semibold shadow-2xl z-50">
          {savedToast}
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background-color: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children, variant }) {
  const variantMap = {
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    success: 'border-green-500/30 bg-green-500/5',
    default: 'border-[var(--border)] bg-[var(--card)]',
  };
  return (
    <section className={`p-4 rounded-xl border ${variantMap[variant || 'default']}`}>
      <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
        {Icon && <Icon className="w-4 h-4" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold mb-1 text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
