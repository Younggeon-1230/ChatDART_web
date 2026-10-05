"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/common/Button";
import Box from "./Box";
import SectionLabel from "./SectionLabel";
import { useRecentCompanies } from "@/hooks/useRecentCompanies";
import { clearRecentCompanies, removeRecentCompany } from "@/lib/recentCompanies";

type Props = {
  title?: string;
};

const MAX_COMPARE_COUNT = 3;
const STORAGE_KEY = "selected-compare-companies";
const DEFAULT_NOTICE = "비교하려면 2개 이상 선택해주세요.";

export default function RelatedCompanyList({
  title = "최근 본 기업",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKeyword = searchParams.get("keyword")?.trim() ?? "";
  const recentCompanies = useRecentCompanies();
  const companyNames = useMemo(
    () => recentCompanies.map((company) => company.name),
    [recentCompanies]
  );

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (!stored) return [];

      const parsed = JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  });
  const [noticeOverride, setNoticeOverride] = useState<string | null>(null);
  const currentCompareCompanies = useMemo(
    () =>
      [
        ...searchParams.getAll("company"),
        searchParams.get("company1") ?? "",
        searchParams.get("company2") ?? "",
        searchParams.get("company3") ?? "",
      ].filter(Boolean),
    [searchParams]
  );

  const visibleSelectedCompanies = useMemo(
    () => selectedCompanies.filter((company) => companyNames.includes(company)),
    [companyNames, selectedCompanies]
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(visibleSelectedCompanies)
    );
  }, [visibleSelectedCompanies]);

  const compareHref = useMemo(() => {
    const params = new URLSearchParams();
    const mergedCompanies =
      pathname === "/compare"
        ? [...currentCompareCompanies, ...visibleSelectedCompanies]
        : visibleSelectedCompanies;
    const uniqueCompanies = [...new Set(mergedCompanies)].slice(
      0,
      MAX_COMPARE_COUNT
    );

    uniqueCompanies.forEach((company) => {
      params.append("company", company);
    });

    return `/compare?${params.toString()}`;
  }, [currentCompareCompanies, pathname, visibleSelectedCompanies]);

  const selectedCountText = `선택한 기업 ${visibleSelectedCompanies.length}개`;

  const selectionGuideText =
    visibleSelectedCompanies.length === 0
      ? "비교하려면 기업을 2개 이상 선택해주세요."
      : visibleSelectedCompanies.length === 1
      ? "1개 더 선택하면 비교할 수 있어요."
      : visibleSelectedCompanies.length === MAX_COMPARE_COUNT
      ? "최대 3개까지 선택했습니다."
      : "비교할 수 있어요. 최대 3개까지 선택할 수 있습니다.";

  const notice = noticeOverride ?? selectionGuideText;

  function moveToSummary(company: string) {
    router.push(`/summary?keyword=${encodeURIComponent(company)}`);
  }

  function enterCompareMode() {
    setIsCompareMode(true);
    setNoticeOverride(null);
  }

  function cancelCompareMode() {
    setIsCompareMode(false);
    setSelectedCompanies([]);
    setNoticeOverride(DEFAULT_NOTICE);
  }

  function toggleCompany(company: string) {
    setSelectedCompanies((prev) => {
      const isSelected = prev.includes(company);

      if (isSelected) {
        setNoticeOverride(null);
        return prev.filter((item) => item !== company);
      }

      if (visibleSelectedCompanies.length >= MAX_COMPARE_COUNT) {
        setNoticeOverride("최대 3개 기업까지 비교할 수 있습니다.");
        return prev;
      }

      setNoticeOverride(null);
      return [...prev, company];
    });
  }

  function handleCompareStart() {
    if (visibleSelectedCompanies.length < 2) {
      setNoticeOverride(DEFAULT_NOTICE);
      return;
    }

    router.push(compareHref);
  }

  function handleClearRecentCompanies() {
    clearRecentCompanies();
    setIsCompareMode(false);
    setSelectedCompanies([]);
    setNoticeOverride(null);
  }

  function handleRemoveRecentCompany(
    event: MouseEvent<HTMLButtonElement>,
    companyName: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    removeRecentCompany(companyName);
    setSelectedCompanies((prev) => prev.filter((item) => item !== companyName));
  }

  return (
    <Box className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden border-blue-100 bg-gradient-to-b from-white to-sky-50/70 p-4 lg:max-h-[calc(100vh-7rem)]">
      <div className="mb-4 shrink-0">
        <SectionLabel>{title}</SectionLabel>
        <p className="-mt-1 text-xs leading-5 text-slate-500">
          최근 조회한 기업을 최신순으로 보여줍니다.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        {companyNames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-sky-200 bg-white/70 px-4 py-5 text-sm leading-6 text-slate-500">
            아직 본 기업이 없습니다. 기업을 검색하면 최근 본 기업이 여기에 표시됩니다.
          </div>
        ) : (
          <div className="space-y-2">
            {companyNames.map((name) => {
              const isSelected = visibleSelectedCompanies.includes(name);
              const isActive = !!activeKeyword && activeKeyword === name;
              const isSelectionLimitReached =
                visibleSelectedCompanies.length >= MAX_COMPARE_COUNT;
              const isComparePageSelected =
                pathname === "/compare" &&
                currentCompareCompanies.includes(name);
              const shouldHighlightCard =
                (isCompareMode && isSelected) ||
                (!isCompareMode && (isActive || isComparePageSelected));

              return (
                <div
                  key={name}
                  className={`rounded-lg border transition ${
                  shouldHighlightCard
                    ? "border-blue-300 bg-blue-50 text-blue-950 shadow-sm shadow-blue-100/60"
                    : "border-sky-100 bg-white hover:border-sky-200 hover:bg-sky-50"
                }`}
                >
                  {isCompareMode ? (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <label
                      className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                        !isSelected && isSelectionLimitReached
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelected && isSelectionLimitReached}
                        onChange={() => toggleCompany(name)}
                        className="h-4 w-4 rounded border-sky-300 text-blue-700 focus:ring-blue-300"
                        aria-label={`${name} 비교 대상으로 선택`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                        {name}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={(event) => handleRemoveRecentCompany(event, name)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                      aria-label={`${name} 최근 본 기업에서 삭제`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => moveToSummary(name)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-slate-700 hover:text-blue-900">
                        {name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => moveToSummary(name)}
                      className="shrink-0 rounded-full p-1 text-sky-500 transition hover:bg-sky-100 hover:text-blue-700"
                      aria-label={`${name} 3줄 요약으로 이동`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleRemoveRecentCompany(event, name)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                      aria-label={`${name} 최근 본 기업에서 삭제`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-sky-100 bg-sky-50/95 pt-3">
        {companyNames.length > 0 && (
          <Button
            type="button"
            onClick={handleClearRecentCompanies}
            variant="outline"
            size="sm"
            className="w-full text-slate-500"
            aria-label="최근 본 기업 전체 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
            전체 삭제
          </Button>
        )}

        <div className="mt-4 rounded-lg border border-sky-100 bg-white/90 p-4 shadow-sm shadow-sky-100/40">
        {!isCompareMode ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">
                기업 비교
              </div>
              <ArrowRightLeft className="h-4 w-4 text-sky-500" />
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              보고 있는 기업 중 2개 이상, 최대 3개까지 선택해 비교 분석으로 바로 이동할 수 있습니다.
            </p>

            <Button
              type="button"
              onClick={enterCompareMode}
              disabled={companyNames.length === 0}
              className="mt-4 w-full"
              size="lg"
            >
              기업 비교
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">
                {selectedCountText}
              </div>
              <ArrowRightLeft className="h-4 w-4 text-sky-500" />
            </div>

            <p className="mt-3 min-h-[44px] break-words text-sm leading-6 text-slate-600">
              {visibleSelectedCompanies.length > 0
                ? visibleSelectedCompanies.join(", ")
                : "아직 선택한 기업이 없습니다."}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {notice || selectionGuideText}
            </p>

            <div className="mt-4 space-y-2">
              <Button
                type="button"
                onClick={handleCompareStart}
                disabled={visibleSelectedCompanies.length < 2}
                className="w-full"
                size="lg"
              >
                비교 시작
              </Button>

              <Button
                type="button"
                onClick={cancelCompareMode}
                variant="outline"
                className="w-full"
                size="lg"
              >
                취소
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </Box>
  );
}
