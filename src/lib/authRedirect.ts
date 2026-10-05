export const DEFAULT_LOGIN_REDIRECT = "/";
export const DEFAULT_LOGOUT_REDIRECT = "/";

function normalizeRedirectSearch(search: string) {
  const params = new URLSearchParams(search);
  params.sort();
  return params.toString();
}

function isSafeInternalRedirect(value: string | null) {
  return (
    !!value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

export function resolveInternalLoginRedirect(
  value: string | null,
  fallback = DEFAULT_LOGIN_REDIRECT
) {
  if (!isSafeInternalRedirect(value)) {
    return fallback;
  }

  return value as string;
}

export function buildLoginHref(pathname: string, search = "") {
  if (pathname === "/login") return "/login";

  const normalizedSearch = normalizeRedirectSearch(search);
  const redirect = resolveInternalLoginRedirect(
    `${pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`
  );
  const params = new URLSearchParams();
  params.set("redirect", redirect);

  return `/login?${params.toString()}`;
}

export function resolveInternalLogoutRedirect(
  value: string | null,
  fallback = DEFAULT_LOGOUT_REDIRECT
) {
  const redirect = resolveInternalLoginRedirect(value, fallback);
  const pathname = new URL(redirect, "http://chatdart.local").pathname;

  if (
    pathname === "/mypage" ||
    pathname.startsWith("/mypage/") ||
    pathname === "/membership" ||
    pathname.startsWith("/membership/")
  ) {
    return fallback;
  }

  return redirect;
}

export function buildLogoutHref(pathname: string, search = "") {
  const normalizedSearch = normalizeRedirectSearch(search);
  const redirect = resolveInternalLogoutRedirect(
    `${pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`
  );
  const params = new URLSearchParams();
  params.set("redirect", redirect);

  return `/logout?${params.toString()}`;
}
