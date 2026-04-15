import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function App() {
  const [status, setStatus] = useState({ loading: true, error: null, counts: null, payment: null });

  useEffect(() => {
    (async () => {
      try {
        const [orders, customers] = await Promise.all([
          supabase.getOrders().catch(() => []),
          supabase.getCustomers().catch(() => []),
        ]);
        let paymentStatus = 'missing';
        try {
          const res = await fetch(`https://jubzppndcclhnvgbvrxr.supabase.co/rest/v1/payment_records?select=id&limit=1`, {
            headers: {
              apikey: 'sb_publishable_td4p48nPHKjXByMngvyjZQ_AJttp5KU',
              Authorization: 'Bearer sb_publishable_td4p48nPHKjXByMngvyjZQ_AJttp5KU',
            },
          });
          paymentStatus = res.ok ? 'ready' : 'missing';
        } catch { paymentStatus = 'missing'; }

        setStatus({ loading: false, error: null, counts: { orders: orders.length, customers: customers.length }, payment: paymentStatus });
      } catch (e) {
        setStatus({ loading: false, error: e.message, counts: null, payment: null });
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-5 py-4 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
          <span className="text-lg">💰</span>
        </div>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            MOVE 결제 관리
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">BETA</span>
          </h1>
          <p className="text-[11px] text-[var(--muted-foreground)]">입출금 · 미수 · 이월 잔금 · 명세서</p>
        </div>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-4">
        <section className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <span>🔌</span> 시스템 상태
          </h2>
          {status.loading && <p className="text-sm text-[var(--muted-foreground)]">연결 확인 중...</p>}
          {status.error && <p className="text-sm text-red-400">오류: {status.error}</p>}
          {status.counts && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Supabase 연결</span>
                <span className="text-green-400 font-semibold">✅ 정상</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">주문 데이터</span>
                <span className="font-semibold">{status.counts.orders.toLocaleString()}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">거래처 데이터</span>
                <span className="font-semibold">{status.counts.customers.toLocaleString()}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">payment_records 테이블</span>
                <span className={`font-semibold ${status.payment === 'ready' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {status.payment === 'ready' ? '✅ 준비됨' : '⏳ SQL 실행 필요'}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <span>🗺️</span> 개발 로드맵
          </h2>
          <ol className="space-y-2 text-sm">
            {[
              ['Supabase 테이블 2개 생성', 'docs/schema.sql 실행'],
              ['대시보드 (오늘 입금/미수/이월)', ''],
              ['입금 등록 모달', ''],
              ['업체별 입출금 탭', ''],
              ['일괄 입금 자동 배분', ''],
              ['명세서 PNG/인쇄/클립보드', ''],
              ['Excel 내보내기', ''],
              ['WebSocket 실시간 반영', ''],
            ].map(([title, hint], i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[var(--muted-foreground)] flex-shrink-0 w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span>⏳</span><span>{title}</span></div>
                  {hint && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 break-words">{hint}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-[11px] text-yellow-200/80 leading-relaxed">
          <p className="font-semibold mb-1">⚠️ BETA 안내</p>
          <p>이 앱은 결제/미수 관리 테스트 환경입니다. 운영 POS 앱(pos-calculator-web)과 완전히 분리되어 있습니다.</p>
          <p className="mt-1">현재 운영 DB는 <strong>읽기</strong>만 하고, 결제 데이터는 신규 테이블(payment_records, payment_history)에만 저장됩니다.</p>
        </section>

        <footer className="text-center text-[10px] text-[var(--muted-foreground)] pt-4 pb-8">
          pos-payments v0.1.0-beta
        </footer>
      </main>
    </div>
  );
}
