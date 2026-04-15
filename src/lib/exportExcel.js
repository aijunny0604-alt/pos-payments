import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const fmt = (n) => Number(n || 0);

export async function exportPaymentsExcel({ records, history, customers }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'pos-payments';
  wb.created = new Date();

  const customerName = (id) => customers.find((c) => c.id === id)?.name || `#${id}`;

  // Sheet 1: 결제 레코드
  const s1 = wb.addWorksheet('결제 레코드');
  s1.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '업체', key: 'customer', width: 20 },
    { header: '주문 ID', key: 'order_id', width: 10 },
    { header: '세금계산서 번호', key: 'invoice_number', width: 16 },
    { header: '발행일', key: 'invoice_date', width: 12 },
    { header: '납기일', key: 'due_date', width: 12 },
    { header: '총액', key: 'total_amount', width: 14, style: { numFmt: '#,##0' } },
    { header: '입금액', key: 'paid_amount', width: 14, style: { numFmt: '#,##0' } },
    { header: '잔금', key: 'balance', width: 14, style: { numFmt: '#,##0' } },
    { header: '상태', key: 'payment_status', width: 10 },
    { header: '메모', key: 'memo', width: 30 },
    { header: '생성일', key: 'created_at', width: 18 },
  ];
  records.forEach((r) => s1.addRow({
    ...r,
    customer: customerName(r.customer_id),
    total_amount: fmt(r.total_amount),
    paid_amount: fmt(r.paid_amount),
    balance: fmt(r.balance),
  }));
  s1.getRow(1).font = { bold: true };
  s1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  // Sheet 2: 입금 이력
  const s2 = wb.addWorksheet('입금 이력');
  s2.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '결제 레코드 ID', key: 'payment_record_id', width: 14 },
    { header: '입금액', key: 'amount', width: 14, style: { numFmt: '#,##0' } },
    { header: '방법', key: 'method', width: 10 },
    { header: '메모', key: 'memo', width: 30 },
    { header: '입금일시', key: 'paid_at', width: 20 },
  ];
  history.forEach((h) => s2.addRow({ ...h, amount: fmt(h.amount) }));
  s2.getRow(1).font = { bold: true };
  s2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

  // Sheet 3: 업체별 미수 합계
  const s3 = wb.addWorksheet('업체별 미수');
  s3.columns = [
    { header: '업체', key: 'customer', width: 20 },
    { header: '미수 건수', key: 'count', width: 12 },
    { header: '이월 잔금', key: 'balance', width: 16, style: { numFmt: '#,##0' } },
  ];
  const byCustomer = new Map();
  for (const r of records) {
    if (!r.customer_id || Number(r.balance) <= 0) continue;
    const prev = byCustomer.get(r.customer_id) || { count: 0, balance: 0 };
    byCustomer.set(r.customer_id, {
      count: prev.count + 1,
      balance: prev.balance + Number(r.balance),
    });
  }
  const sorted = [...byCustomer.entries()].sort((a, b) => b[1].balance - a[1].balance);
  for (const [id, v] of sorted) {
    s3.addRow({ customer: customerName(id), count: v.count, balance: v.balance });
  }
  s3.getRow(1).font = { bold: true };
  s3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `pos-payments_${dateStr}.xlsx`);
}
