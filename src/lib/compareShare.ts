export const COMPARE_SHARE_ID_PATTERN = /^[0-9a-fA-F]{8,16}$/;

export function isValidCompareShareId(value: string) {
  return COMPARE_SHARE_ID_PATTERN.test(value);
}

export function formatCompareShareExpiry(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
