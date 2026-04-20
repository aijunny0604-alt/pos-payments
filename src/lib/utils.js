// 가격 포맷
export const formatPrice = (price) => {
  if (price === undefined || price === null) return '0';
  return Number(price).toLocaleString('ko-KR');
};

// 공급가액 (VAT 제외)
export const calcExVat = (price) => Math.round(Number(price || 0) / 1.1);

// 한국시간(KST) 기준 오늘 (YYYY-MM-DD)
export const getTodayKST = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

// YYYY-MM-DD 에 일수 가감
export const offsetDateKST = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

// YYYY-MM-DD 에 월 가감
export const offsetMonthKST = (dateStr, months) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
};

// ISO/타임스탬프 → KST YYYY-MM-DD
export const toDateKST = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

// 날짜+시간 표시
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

// 시간만
export const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit',
  });
};
