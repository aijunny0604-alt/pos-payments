import { RefreshCw, Database, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function SettingsPage({
  customers, recordsCount, syncing, syncResult, exporting,
  onSync, onExport, onRefresh,
}) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-base font-bold">설정 / 동기화</h2>

      {/* 시스템 상태 */}
      <Section title="🔌 시스템 상태" icon={Database}>
        <Stat label="Supabase 연결" value="✅ 정상" />
        <Stat label="고객 데이터" value={`${fmt(customers.length)}명`} />
        <Stat label="등록된 결제 레코드" value={`${fmt(recordsCount)}건`} />
      </Section>

      {/* 동기화 */}
      <Section title="🔄 운영 주문 동기화" icon={RefreshCw}>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-2">
          운영 앱(pos-calculator-web)의 주문 데이터를 읽어, 결제 레코드에 없는 주문을 자동 생성합니다.
        </p>
        <ul className="text-[11px] text-[var(--muted-foreground)] space-y-0.5 mb-3 ml-4 list-disc">
          <li>운영 orders 테이블은 <strong>READ만</strong> (변경 0)</li>
          <li>이미 동기화된 주문은 건너뜀</li>
          <li>업체는 이름 → 전화번호 순으로 매칭</li>
          <li>금액 = 주문 총액 − 환불 금액</li>
        </ul>
        <button
          onClick={onSync}
          disabled={syncing}
          className="w-full py-3 rounded-lg text-sm font-bold border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] disabled:opacity-50 hover:bg-[var(--primary)]/20"
        >
          {syncing ? '⟳ 동기화 중...' : '🔄 지금 동기화'}
        </button>
        {syncResult && (
          <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300 leading-relaxed">
            ✅ 완료: 전체 {syncResult.total}건 중 <strong>{syncResult.inserted}건 신규</strong>
            {syncResult.skippedAlreadySynced > 0 && <div>• 이미 동기화: {syncResult.skippedAlreadySynced}건</div>}
            {syncResult.skippedNoCustomer > 0 && <div>• 업체 매칭 실패: {syncResult.skippedNoCustomer}건</div>}
          </div>
        )}
      </Section>

      {/* Excel */}
      <Section title="📊 데이터 내보내기" icon={FileSpreadsheet}>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">
          모든 결제 레코드 + 입금 이력 + 업체별 미수 합계를 Excel 3시트로 다운로드.
        </p>
        <button
          onClick={onExport}
          disabled={exporting}
          className="w-full py-3 rounded-lg text-sm font-bold border border-[var(--border)] bg-[var(--card)] disabled:opacity-50 hover:bg-[var(--accent)]"
        >
          {exporting ? '⟳ 생성 중...' : '📥 Excel 다운로드'}
        </button>
      </Section>

      {/* 새로고침 */}
      <Section title="🔃 데이터 새로고침" icon={RefreshCw}>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">
          WebSocket이 실시간 반영을 처리하지만, 수동 새로고침이 필요할 때.
        </p>
        <button
          onClick={onRefresh}
          className="w-full py-3 rounded-lg text-sm font-bold border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)]"
        >
          ↻ 모든 데이터 새로고침
        </button>
      </Section>

      {/* 안전 안내 */}
      <Section title="⚠️ BETA 안내" icon={AlertTriangle} variant="warning">
        <ul className="text-xs space-y-1.5 leading-relaxed">
          <li className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
            <span>운영 POS 앱(pos-calculator-web)과 <strong>완전 분리</strong> — 코드/배포/테이블 영향 0</span>
          </li>
          <li className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
            <span>운영 DB는 <strong>읽기만</strong>, 결제 데이터는 신규 테이블(payment_records, payment_history)에만 저장</span>
          </li>
          <li className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
            <span>비밀번호 없음 — URL 본인만 공유 (브라우저 히스토리/북마크 동기화 주의)</span>
          </li>
          <li className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
            <span>실사용 후 정식 공개 시 인증 추가 필요</span>
          </li>
        </ul>
      </Section>

      {/* 버전 */}
      <div className="text-center text-[10px] text-[var(--muted-foreground)] py-3">
        pos-payments v1.3.0-beta · build {new Date().toISOString().slice(0, 10)}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, variant }) {
  const variantMap = {
    warning: 'border-yellow-500/30 bg-yellow-500/5',
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

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
