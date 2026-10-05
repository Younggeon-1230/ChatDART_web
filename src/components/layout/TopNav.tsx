"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { useSyncExternalStore } from "react";
import MockDataBanner from "@/components/layout/MockDataBanner";
import { buildLoginHref, buildLogoutHref } from "@/lib/authRedirect";
import { AUTH_STORAGE_EVENT, hasStoredAccessToken } from "@/lib/authTokens";
import { cn } from "@/lib/classNames";

type AnalysisTarget = {
  keyword: string | null;
  corpCode: string | null;
  stockCode: string | null;
  displayName: string | null;
};

type NavItem = {
  label: string;
  path: string;
  buildHref: (target: AnalysisTarget) => string;
};

const ANALYSIS_NAV_ITEMS: NavItem[] = [
  {
    label: "MAIN",
    path: "/",
    buildHref: () => "/",
  },
  {
    label: "3줄 요약",
    path: "/summary",
    buildHref: (target) => buildAnalysisHref("/summary", target),
  },
  {
    label: "상세 분석",
    path: "/detail",
    buildHref: (target) => buildAnalysisHref("/detail", target),
  },
  {
    label: "기업 비교",
    path: "/compare",
    buildHref: (target) =>
      target.keyword
        ? `/compare?company1=${encodeURIComponent(target.keyword)}`
        : "/compare",
  },
  {
    label: "멤버십",
    path: "/membership",
    buildHref: () => "/membership",
  },
];

function buildAnalysisHref(path: string, target: AnalysisTarget) {
  const { keyword, corpCode, stockCode, displayName } = target;
  if (!keyword) return path;

  const params = new URLSearchParams();
  params.set("keyword", keyword);
  if (corpCode) params.set("corpCode", corpCode);
  if (stockCode) params.set("stockCode", stockCode);
  if (displayName) params.set("displayName", displayName);

  return `${path}?${params.toString()}`;
}

function cleanSearchParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function isActivePath(pathname: string, itemPath: string) {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function subscribeToAuthStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_STORAGE_EVENT, callback);
  };
}

export default function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLoggedIn = useSyncExternalStore(
    subscribeToAuthStorage,
    hasStoredAccessToken,
    () => false
  );

  const keyword =
    cleanSearchParam(searchParams.get("keyword")) ??
    cleanSearchParam(searchParams.get("company1"));
  const analysisTarget: AnalysisTarget = {
    keyword,
    corpCode: cleanSearchParam(searchParams.get("corpCode")),
    stockCode: cleanSearchParam(searchParams.get("stockCode")),
    displayName: cleanSearchParam(searchParams.get("displayName")),
  };
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const logoutHref = buildLogoutHref(pathname, searchParams.toString());

  return (
    <div className="sticky top-0 z-50 flex flex-col gap-2 px-4 py-4 md:px-6 md:py-5">
      <div className="grid max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Link
          href="/"
          aria-label="ChatDART 메인으로 이동"
          className="inline-flex min-h-11 w-fit shrink-0 items-center rounded-lg border border-sky-100 bg-white/95 px-3 text-sm font-extrabold tracking-tight shadow-md shadow-sky-100/60 transition-all hover:shadow-lg hover:shadow-sky-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 supports-[backdrop-filter]:bg-white/85 sm:px-5"
        >
          <span className="bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 bg-clip-text text-transparent">
            ChatDART
          </span>
        </Link>

        <nav
          aria-label="주요 페이지"
          className="col-span-2 row-start-2 min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-sky-100 bg-white/95 px-3 py-3 shadow-md shadow-sky-100/60 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:rounded-full sm:px-5 lg:col-span-1 lg:col-start-2 lg:row-start-1"
        >
          <div className="flex min-w-max items-center justify-center gap-4 whitespace-nowrap text-sm md:gap-7">
            {ANALYSIS_NAV_ITEMS.map((item) => {
              const href = item.buildHref(analysisTarget);
              const isActive = isActivePath(pathname, item.path);

              return (
                <Link
                  key={item.path}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition",
                    isActive
                      ? "bg-blue-50 font-semibold text-blue-900"
                      : "text-slate-600 hover:bg-sky-50 hover:text-blue-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex min-w-0 justify-end gap-2">
          {isLoggedIn ? (
            <>
              <Link
                href="/mypage"
                aria-label="마이페이지"
                aria-current={isActivePath(pathname, "/mypage") ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 sm:text-sm",
                  isActivePath(pathname, "/mypage")
                    ? "border-blue-200 bg-blue-50 text-blue-950"
                    : "border-sky-200 bg-white/95 text-slate-700 hover:border-blue-200 hover:bg-sky-50"
                )}
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">마이페이지</span>
              </Link>
              <Link
                href={logoutHref}
                aria-label="로그아웃"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white/95 px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-sky-50 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 sm:text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </Link>
            </>
          ) : (
            <Link
              href={loginHref}
              aria-current={isActivePath(pathname, "/login") ? "page" : undefined}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-950 px-4 text-xs font-medium text-white shadow-sm shadow-blue-950/10 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:text-sm"
            >
              <LogIn className="h-4 w-4" />
              로그인
            </Link>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <MockDataBanner />
      </div>
    </div>
  );
}
