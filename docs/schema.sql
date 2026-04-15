-- pos-payments Supabase 스키마
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- 주의: 기존 운영 테이블(orders, customers, products 등)은 건드리지 않음
--      신규 2개 테이블만 추가

-- 1. 주문별 결제 레코드 (orders와 soft link, FK 없음으로 원본 영향 0)
CREATE TABLE IF NOT EXISTS payment_records (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT,                            -- orders.id 참조 (soft)
  customer_id BIGINT,                         -- customers.id 참조 (soft)
  total_amount NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  payment_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN paid_amount = 0 THEN 'unpaid'
      WHEN paid_amount < total_amount THEN 'partial'
      ELSE 'paid'
    END
  ) STORED,
  invoice_date DATE,
  invoice_number TEXT,
  due_date DATE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 입금 이력 (payment_records와 1:N)
CREATE TABLE IF NOT EXISTS payment_history (
  id BIGSERIAL PRIMARY KEY,
  payment_record_id BIGINT NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT,                                -- 현금/계좌이체/카드
  memo TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 트리거: payment_history 변경 시 payment_records.paid_amount 자동 재계산
CREATE OR REPLACE FUNCTION recalc_payment_record() RETURNS TRIGGER AS $$
DECLARE
  target_id BIGINT;
BEGIN
  target_id := COALESCE(NEW.payment_record_id, OLD.payment_record_id);
  UPDATE payment_records
  SET
    paid_amount = COALESCE((SELECT SUM(amount) FROM payment_history WHERE payment_record_id = target_id), 0),
    updated_at = NOW()
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_payment ON payment_history;
CREATE TRIGGER trg_recalc_payment
AFTER INSERT OR UPDATE OR DELETE ON payment_history
FOR EACH ROW EXECUTE FUNCTION recalc_payment_record();

-- 4. 인덱스 (검색/필터 성능)
CREATE INDEX IF NOT EXISTS idx_payment_records_customer ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_date ON payment_records(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_due_date ON payment_records(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_history_record ON payment_history(payment_record_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_paid_at ON payment_history(paid_at);

-- 5. RLS (기존 앱과 동일하게 비활성 — 베타 기간)
ALTER TABLE payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history DISABLE ROW LEVEL SECURITY;

-- 6. 확인 쿼리 (실행 후 테이블 생성 확인용)
-- SELECT * FROM payment_records LIMIT 1;
-- SELECT * FROM payment_history LIMIT 1;
