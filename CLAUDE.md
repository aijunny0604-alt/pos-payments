# POS Payments (BETA)

> Created: 2026-04-15
> Last sync: 2026-04-15 (v3.6.0-beta)
> 배포 URL: https://aijunny0604-alt.github.io/pos-payments/
> 원본 앱: `pos-calculator-web` (운영 POS — 완전히 분리된 별도 환경)

**운영 POS 앱과 0% 영향** — 입출금/미수/이월/명세서/세금계산서 관리 전용 회계 보조 시스템.

---

## 🚨 핵심 제약 (절대 지킬 것)

1. **기존 운영 테이블 ALTER 금지** — `orders`, `customers`, `products`, `customer_returns`, `saved_carts`, `ai_learning` 변경 불가
2. **신규 테이블만 사용** — `payment_records`, `payment_history`, `app_settings`
3. **기존 데이터는 읽기 전용** — orders/customers는 SELECT만
4. **PIN 비번** — 설정 페이지에서 PIN 활성/비활성 (24h 세션 토큰)
5. **소유자만 사용** — URL 유출 주의, 정식 공개 시 인증 강화 필수

---

## 🛠️ 기술 스택

- React 18 + Vite 6 + Tailwind CSS v3
- Supabase (`@supabase/supabase-js`) — REST + Realtime
- 라이브러리: `exceljs`, `file-saver`, `html-to-image`, `lucide-react`
- 라우팅: 커스텀 hash router (`#dashboard`, `#payments`, `#customers`, `#invoices`, `#settings`)
- 인증: 클라이언트 SHA-256 + localStorage 토큰 (24h)

---

## 🏗️ 폴더 구조

```
src/
├── App.jsx                          # 라우터 + 모달 오케스트레이터 + 인증 게이트
├── main.jsx
├── index.css
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx            # 사이드바 + 헤더 + 모바일네비
│   │   ├── Sidebar.jsx              # 데스크톱 네비 (이월잔금/연체 표시)
│   │   ├── Header.jsx               # 페이지 제목 + 오늘 입금 + 온라인 표시
│   │   └── MobileNav.jsx            # 하단 5탭
│   ├── PaymentRegisterModal.jsx     # 입금/출금 등록 (기존/신규 모드, VAT 자동)
│   ├── PaymentEditModal.jsx         # 입금 이력 수정/삭제
│   ├── CustomerDetailModal.jsx      # 업체 상세 (미수/입금/주문 3탭) + Excel/인쇄
│   └── BulkPaymentModal.jsx         # 일괄 입금 자동 배분
├── pages/
│   ├── DashboardPage.jsx            # 요약 + 빠른 액션 + 연체 + TOP + 최근입금
│   ├── PaymentsPage.jsx             # 결제 레코드/입금 이력 탭 + 다중 필터
│   ├── CustomersPage.jsx            # 업체 리스트 (미수순 정렬)
│   ├── InvoicesPage.jsx             # 명세서 발행 (PNG/인쇄/복사 + 이월잔금 자동)
│   ├── SettingsPage.jsx             # 회사정보/PIN/카테고리/동기화/Excel
│   └── AuthPage.jsx                 # PIN 로그인 화면
└── lib/
    ├── supabase.js                  # API 래퍼 (CRUD + 집계 + 동기화)
    ├── exportExcel.js               # 3종 Excel (전체/필터/업체별 5시트)
    └── vatHelper.js                 # 부가세 계산 + 카테고리 헬퍼
```

---

## 🗄️ Supabase 스키마

### 신규 테이블 (본 앱 전용)
- **payment_records** — 주문별 결제 레코드
  - `id`, `order_id` TEXT, `customer_id` TEXT
  - `total_amount`, `paid_amount`, `balance` (GENERATED), `payment_status` (GENERATED)
  - `supply_amount`, `vat_amount`, `is_vat_exempt`, `category` (sales/shipping/quick/ad/other)
  - `invoice_number`, `invoice_date`, `due_date`, `invoice_issued`, `invoice_issued_at`
  - `memo`, `created_at`, `updated_at`
- **payment_history** — 입금/출금 이력 (1:N)
  - `id`, `payment_record_id` (FK), `amount`, `method`, `memo`, `paid_at`
  - `type` ('income' | 'expense')
  - **DB 트리거** `recalc_payment_record()` — INSERT/UPDATE/DELETE 시 paid_amount 자동 재계산 (expense는 차감)
- **app_settings** (singleton) — 회사 정보 + 카테고리 + PIN
  - `company_name`, `business_number`, `company_address`, `company_phone`, `bank_account`
  - `invoice_footer`, `invoice_prefix`, `invoice_seq`
  - `pin_hash` (SHA-256), `pin_required`
  - `expense_categories` (JSONB), `default_vat_rate`

### 운영 테이블 (READ ONLY)
- `orders` (234행) — order_id, customer_name, customer_phone, items(JSONB), total, total_returned
- `customers` (138행) — id (TEXT/UUID), name, phone, address
- 기타: `products`, `customer_returns`, `saved_carts`, `ai_learning`

### RPC
- `next_invoice_number()` → `{prefix}-{YYYY}-{0000}` 자동 채번

---

## 📋 기능 (v3.6 기준)

### 페이지 5개
| 페이지 | 기능 |
|--------|------|
| 대시보드 | 오늘 입금/미수/연체 카드 + 빠른 액션 + 연체 배너 + 업체 TOP + 최근 입금(업체+잔금 표시) |
| 입출금 내역 | 결제 레코드/입금 이력 탭 + 다중 필터(상태/발행/카테고리/업체/검색) + 카드 클릭→업체 |
| 업체별 미수 | 업체 리스트 (미수 정렬), 상세 모달 진입 |
| 명세서 | 발행일+업체 선택 → PNG/인쇄/클립보드 + 전월이월 자동 + VAT 분리 표시 |
| 설정 | 회사정보 / PIN 인증 / 자동 채번 prefix / 동기화 / Excel / 새로고침 |

### 모달 4개
- **PaymentRegisterModal** — 입금/출금 토글 + 기존/신규 모드 + 카테고리 5종 + VAT 자동 + 자동 채번
- **PaymentEditModal** — 입금 이력 수정/삭제 (트리거 자동 재계산)
- **CustomerDetailModal** — 미수/입금/주문 3탭 + 빠른 입금([⚡전액][✏️직접]) + 일괄 입금 진입 + Excel/인쇄
- **BulkPaymentModal** — 미수 카드 선택 + 자동 배분 (오래된 순) 미리보기

### 카테고리 (자유 설정)
- 💼 매출 (VAT 10%) · 📦 택배비 (비과세) · 🚚 퀵비 (비과세) · 📢 광고비 (비과세) · 📋 기타

### 데이터 흐름
```
운영 POS → orders 생성
   ↓ [동기화 버튼]
syncOrdersToPaymentRecords (이름/전화 매칭, 중복 방지)
   ↓
payment_records 자동 생성 (VAT 10% 자동 분리)
   ↓ [입금 등록 / 빠른 입금 / 일괄 입금]
payment_history INSERT
   ↓ DB 트리거
payment_records.paid_amount 자동 갱신 → balance/status 자동 재계산
   ↓ Realtime
WebSocket → 모든 세션 자동 새로고침
```

---

## 🚀 빌드/배포

```bash
npm install              # 최초 1회
npm run dev              # 개발 서버 (http://localhost:5173)
npx vite build           # 빌드 (--base 플래그 금지! vite.config.js에 설정됨)
```

### GitHub Pages 배포 (Windows gh-pages 캐시 버그 우회)

```bash
npx vite build
cd dist
git init -b gh-pages
git config user.name "aijunny0604-alt"
git config user.email "aijunny0604-alt@users.noreply.github.com"
git add -A
git commit -m "Deploy"
git remote add origin https://github.com/aijunny0604-alt/pos-payments.git
git push -f origin gh-pages
cd .. && rm -rf dist/.git
```

> `npx gh-pages -d dist`는 Windows에서 `.gitignore` 캐시 이슈로 PNG 누락. 위 수동 방식 사용.

---

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

---

## 📚 관련 문서

- 기획안: `pos-calculator-web/docs/01-plan/features/payments-management.plan.md`
- 분석: `pos-calculator-web/docs/03-analysis/payments-management.analysis.md`
- 보고: `pos-calculator-web/docs/04-report/payments-management.report.md`
- 스키마: `docs/schema.sql` (전체 마이그레이션, Supabase MCP로 적용 완료)
