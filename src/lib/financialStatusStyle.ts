export type FinancialStatusTone =
  | "positive"
  | "negative"
  | "neutral"
  | "fallback";

const POSITIVE_STATUSES = [
  "우수",
  "양호",
  "개선",
  "안정",
  "건강",
  "정상",
  "좋음",
  "healthy",
  "good",
  "great",
  "excellent",
  "strong",
  "stable",
  "ready",
  "ok",
];

const NEGATIVE_STATUSES = [
  "부진",
  "주의",
  "위험",
  "악화",
  "취약",
  "risk",
  "warning",
  "bad",
  "failed",
];

const NEUTRAL_STATUSES = ["보합", "유지", "보통"];

export const FINANCIAL_STATUS_TEXT_TERMS = [
  "정보 부족",
  "정보 없음",
  "우수",
  "양호",
  "개선",
  "보합",
  "유지",
  "보통",
  "부진",
  "주의",
  "위험",
  "악화",
  "취약",
].sort((a, b) => b.length - a.length);

function includesStatus(value: string, statuses: string[]) {
  return statuses.some((status) => value.includes(status));
}

export function getFinancialStatusTone(
  status?: string | null
): FinancialStatusTone {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) return "fallback";
  if (includesStatus(normalized, NEGATIVE_STATUSES)) return "negative";
  if (includesStatus(normalized, NEUTRAL_STATUSES)) return "neutral";
  if (includesStatus(normalized, POSITIVE_STATUSES)) return "positive";
  return "fallback";
}

export function getFinancialStatusTextClass(status?: string | null) {
  switch (getFinancialStatusTone(status)) {
    case "positive":
      return "text-emerald-600";
    case "negative":
      return "text-red-600";
    case "neutral":
      return "text-[#ffd700]";
    default:
      return "text-slate-900";
  }
}

export function getFinancialStatusChipClass(status?: string | null) {
  switch (getFinancialStatusTone(status)) {
    case "positive":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "negative":
      return "border-red-200 bg-red-50 text-red-700";
    case "neutral":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function isPositiveFinancialStatus(status?: string | null) {
  return getFinancialStatusTone(status) === "positive";
}
