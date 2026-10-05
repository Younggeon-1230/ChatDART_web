export type NumericValue = number | null | undefined;

export const isInvalidNumber = (
  value: NumericValue
): value is null | undefined => {
  return value == null || !Number.isFinite(value);
};

export const formatNumber = (value: NumericValue): string => {
  if (isInvalidNumber(value)) return "-";
  return value.toLocaleString("ko-KR");
};

export const formatCurrency = (
  value: NumericValue,
  unit = "원"
): string => {
  if (isInvalidNumber(value)) return "-";
  return `${formatNumber(value)}${unit}`;
};

export const formatPercent = (
  value: NumericValue,
  digits = 2
): string => {
  if (isInvalidNumber(value)) return "-";
  return `${value.toFixed(digits)}%`;
};

export const formatSignedPercent = (
  value: NumericValue,
  digits = 2
): string => {
  if (isInvalidNumber(value)) return "-";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
};

export const formatRatio = (
  value: NumericValue,
  digits = 2
): string => {
  if (isInvalidNumber(value)) return "-";
  return value.toFixed(digits);
};

export const formatKoreanWon = (value: NumericValue): string => {
  if (isInvalidNumber(value)) return "-";

  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  const eok = Math.floor(absValue / 100_000_000);
  const jo = Math.floor(eok / 10_000);
  const remainEok = eok % 10_000;

  if (jo > 0 && remainEok > 0) {
    return `${sign}${formatNumber(jo)}조 ${formatNumber(remainEok)}억원`;
  }

  if (jo > 0) {
    return `${sign}${formatNumber(jo)}조원`;
  }

  if (eok > 0) {
    return `${sign}${formatNumber(eok)}억원`;
  }

  return `${sign}${formatNumber(absValue)}원`;
};

export function formatKRW(won: NumericValue): string {
  if (isInvalidNumber(won)) return "-";

  const jo = Math.floor(won / 1e12);
  const eok = Math.floor((won % 1e12) / 1e8);

  if (jo > 0) {
    return `${formatNumber(jo)}조 ${formatCurrency(eok, "억")}`;
  }

  return formatCurrency(Math.round(won / 1e8), "억");
}
