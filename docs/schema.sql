-- pos-payments 전체 Supabase 스키마 (v3.6 통합)
-- 초기 설치: Supabase SQL Editor → 이 파일 전체 붙여넣기 → Run
-- 이미 테이블 있으면 IF NOT EXISTS로 안전하게 스킵
-- 주의: 운영 테이블(orders, customers 등)은 절대 변경하지 않음

-- ═══════════════════════════════════════════════
-- 1. payment_records (주문별 결제 레코드)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_records (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT,                                -- orders.id 참조 (soft link, FK 없음)
  customer_id TEXT,                             -- customers.id 참조 (soft link, FK 없음)
  total_amount NUMERIC NOT NULL,               -- 합계 (공급가+부가세)
  paid_amount NUMERIC NOT NULL DEFAULT 0,      -- 누적 입금액 (트리거 자동 갱신)
  balance NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  payment_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN paid_amount = 0 THEN 'unpaid'
      WHEN paid_amount < total_amount THEN 'partial'
      ELSE 'paid'
    END
  ) STORED,
  -- 부가세 (v3.5)
  supply_amount NUMERIC,                       -- 공급가액
  vat_amount NUMERIC DEFAULT 0,                -- 부가세
  is_vat_exempt BOOLEAN DEFAULT false,         -- 비과세 여부
  category TEXT DEFAULT 'sales',               -- sales/shipping/quick/ad/other
  -- 세금계산서
  invoice_date DATE,
  invoice_number TEXT,
  invoice_issued BOOLEAN DEFAULT false,        -- 발행 완료 체크 (v3.2)
  invoice_issued_at TIMESTAMPTZ,
  -- 기타
  due_date DATE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- 2. payment_history (입금/출금 이력, 1:N)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_history (
  id BIGSERIAL PRIMARY KEY,
  payment_record_id BIGINT NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT,                                  -- 현금/계좌이체/카드
  memo TEXT,
  type TEXT DEFAULT 'income',                   -- income(입금) / expense(출금) (v3.0)
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- 3. app_settings (앱 설정, singleton) (v3.0)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT DEFAULT 'MOVE MOTORS',
  business_number TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  invoice_footer TEXT DEFAULT '입금 확인 부탁드립니다.',
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_seq INTEGER DEFAULT 0,
  pin_hash TEXT DEFAULT '',
  pin_required BOOLEAN DEFAULT false,
  expense_categories JSONB DEFAULT
    '[{"key":"sales","label":"매출","icon":"💼","vat_exempt":false},
      {"key":"shipping","label":"택배비","icon":"📦","vat_exempt":true},
      {"key":"quick","label":"퀵비","icon":"🚚","vat_exempt":true},
      {"key":"ad","label":"광고비","icon":"📢","vat_exempt":true},
      {"key":"other","label":"기타","icon":"📋","vat_exempt":false}]'::jsonb,
  default_vat_rate NUMERIC DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════
-- 4. 트리거: payment_history 변경 → paid_amount 자동 재계산
--    expense 타입은 차감 처리
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION recalc_payment_record() RETURNS TRIGGER AS $$
DECLARE
  target_id BIGINT;
BEGIN
  target_id := COALESCE(NEW.payment_record_id, OLD.payment_record_id);
  UPDATE payment_records
  SET
    paid_amount = COALESCE((
      SELECT SUM(CASE WHEN type = 'expense' THEN -amount ELSE amount END)
      FROM payment_history
      WHERE payment_record_id = target_id
    ), 0),
    updated_at = NOW()
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_payment ON payment_history;
CREATE TRIGGER trg_recalc_payment
AFTER INSERT OR UPDATE OR DELETE ON payment_history
FOR EACH ROW EXECUTE FUNCTION recalc_payment_record();

-- ═══════════════════════════════════════════════
-- 5. 자동 채번 RPC (v3.0)
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION next_invoice_number() RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq INTEGER;
  yr TEXT;
BEGIN
  yr := TO_CHAR(NOW(), 'YYYY');
  UPDATE app_settings SET invoice_seq = invoice_seq + 1 WHERE id = 1
  RETURNING invoice_prefix, invoice_seq INTO prefix, seq;
  RETURN prefix || '-' || yr || '-' || LPAD(seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════
-- 6. 인덱스 (검색/필터 성능)
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_payment_records_customer ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_date ON payment_records(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_due_date ON payment_records(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_records_category ON payment_records(category);
CREATE INDEX IF NOT EXISTS idx_payment_records_vat_exempt ON payment_records(is_vat_exempt);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_issued ON payment_records(invoice_issued);
CREATE INDEX IF NOT EXISTS idx_payment_history_record ON payment_history(payment_record_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_paid_at ON payment_history(paid_at);

-- ═══════════════════════════════════════════════
-- 7. RLS 비활성 (베타 기간, anon key 접근)
-- ═══════════════════════════════════════════════
ALTER TABLE payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════
-- 확인 쿼리 (실행 후)
-- SELECT COUNT(*) FROM payment_records;
-- SELECT COUNT(*) FROM payment_history;
-- SELECT * FROM app_settings;
-- ═══════════════════════════════════════════════
