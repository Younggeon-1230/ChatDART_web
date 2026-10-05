import {
  formatNumber,
  formatRatio,
  type NumericValue,
} from "@/lib/format";

const KOREAN_JO = String.fromCharCode(0xc870);
const KOREAN_EOK = String.fromCharCode(0xc5b5);
const KOREAN_MAN = String.fromCharCode(0xb9cc);

export function formatAmount(value: NumericValue) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  const abs = Math.abs(value);

  if (abs >= 1_0000_0000_0000) {
    return `${formatRatio(value / 1_0000_0000_0000, 1)}${KOREAN_JO}`;
  }

  if (abs >= 1_0000_0000) {
    return `${formatRatio(value / 1_0000_0000, 1)}${KOREAN_EOK}`;
  }

  if (abs >= 1_0000) {
    return `${formatRatio(value / 1_0000, 1)}${KOREAN_MAN}`;
  }

  return formatNumber(value);
}
