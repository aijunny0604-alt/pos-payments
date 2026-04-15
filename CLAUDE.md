# POS Payments (BETA)

> Created: 2026-04-15
> 배포 URL: https://aijunny0604-alt.github.io/pos-payments/
> 원본 앱: `pos-calculator-web` (운영 POS — 본 앱은 완전히 분리된 테스트 환경)

**운영 POS 앱과 0% 영향** 입출금/미수/이월/명세서 전용 테스트 앱.

## 🚨 핵심 제약 (절대 지킬 것)

1. **기존 테이블 ALTER 금지** — orders, customers, products 등 운영 테이블 변경 불가
2. **신규 2개 테이블만 사용** — `payment_records`, `payment_history`
3. **기존 데이터는 읽기 전용** — orders, customers는 SELECT만
4. **비번 없음** (BETA) — URL 본인만 공유, 유출 시 즉시 저장소 삭제 후 재생성

## 빌드/배포

```bash
npm install              # 최초 1회
npm run dev              # 개발 서버 (http://localhost:5173)
npx vite build           # 빌드 (--base 플래그 절대 금지!)
npx gh-pages -d dist     # GitHub Pages 배포
```

> `vite.config.js`에 `base: '/pos-payments/'` 설정됨.

## Supabase

- URL: `https://jubzppndcclhnvgbvrxr.supabase.co` (운영과 공유)
- **읽기**: `orders`, `customers` (운영 테이블, 변경 금지)
- **쓰기**: `payment_records`, `payment_history` (본 앱 전용)
- 최초 1회: `docs/schema.sql` 을 Supabase SQL Editor에서 실행

## 다른 PC에서 이어서 작업

```bash
git clone https://github.com/aijunny0604-alt/pos-payments.git
cd pos-payments
npm install
npm run dev
```

변경 후:
```bash
git add . && git commit -m "message" && git push
```

## 기획 문서

원본 기획안: `pos-calculator-web/docs/01-plan/features/payments-management.plan.md`
(운영 앱 저장소 참조)
