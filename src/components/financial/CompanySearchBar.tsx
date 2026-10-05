"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Search } from "lucide-react";
import Button from "@/components/common/Button";
import { InlineStatusMessage } from "@/components/common/StatusState";
import CompanyAutocompleteDropdown from "@/components/financial/CompanyAutocompleteDropdown";
import {
  useDataSource,
} from "@/components/layout/DataSourceProvider";
import {
  type AnalysisStatus,
  useCompanySearch,
} from "@/hooks/useCompanySearch";
import {
  type CompanyAnalysisTarget,
  MIN_BACKEND_LOADING_MS,
  type CompanySearchItem,
  findBestCompanySearchMatch,
  getCompanyDisplayName,
  searchCompanies,
  toCompanyAnalysisTarget,
} from "@/lib/companySearch";

export type CompanySearchResult = CompanyAnalysisTarget & {
  corpName: string;
  market?: string;
  sector?: string;
  industry?: string;
  business?: string;
};

type CompanySearchBarProps = {
  placeholder?: string;
  initialKeyword?: string;
  onSelect: (company: CompanySearchResult) => void;
  className?: string;
  compact?: boolean;
};

export default function CompanySearchBar({
  placeholder = "기업명 또는 종목코드를 입력하세요",
  initialKeyword = "",
  onSelect,
  className = "",
  compact = false,
}: CompanySearchBarProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisStatus>("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const {
    query,
    setQuery,
    setQuerySilently,
    normalizedQuery,
    status,
    isLoading,
    results,
    suggestions,
    errorMessage,
    hasUserInteracted,
    setHasUserInteracted,
    runSearch,
    reset,
  } = useCompanySearch({ initialQuery: initialKeyword });
  const {
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
  } = useDataSource();

  const trimmedQuery = normalizedQuery.collapsed;
  const isRunningAnalysis = analysisStatus === "loading";
  const shouldShowShortAliasHelp =
    hasUserInteracted && /^[A-Za-z]{1,3}$/.test(trimmedQuery);
  const visibleItems = useMemo(
    () => (results.length > 0 ? results : suggestions).slice(0, 8),
    [results, suggestions]
  );
  const shouldShowDropdown =
    isOpen &&
    hasUserInteracted &&
    !!trimmedQuery &&
    (isLoading ||
      status === "error" ||
      status === "empty" ||
      visibleItems.length > 0);
  const effectiveHighlightedIndex =
    shouldShowDropdown &&
    highlightedIndex >= 0 &&
    highlightedIndex < visibleItems.length
      ? highlightedIndex
      : -1;
  const activeDescendant =
    effectiveHighlightedIndex >= 0
      ? `${listboxId}-option-${effectiveHighlightedIndex}`
      : undefined;

  const containerClassName = useMemo(
    () =>
      [
        "relative z-30 rounded-lg border border-sky-200 bg-white shadow-md shadow-sky-100/70 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100",
        compact ? "p-3" : "p-4",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className, compact]
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function toSearchResultFromTarget(
    target: CompanyAnalysisTarget
  ): CompanySearchResult {
    return {
      ...target,
      corpName: target.keyword,
    };
  }

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForMinimumDuration(startedAt: number) {
    const elapsed = Date.now() - startedAt;

    if (elapsed < MIN_BACKEND_LOADING_MS) {
      await wait(MIN_BACKEND_LOADING_MS - elapsed);
    }
  }

  async function resolveCompanyTargetFromQuery(
    rawQuery: string
  ): Promise<CompanyAnalysisTarget | null> {
    const normalizedRawQuery = rawQuery.trim();

    try {
      const response = await searchCompanies(normalizedRawQuery);
      const candidates = [
        ...response.results,
        ...(response.suggestions ?? []),
      ];
      const firstCompany = findBestCompanySearchMatch(
        candidates,
        normalizedRawQuery
      );

      if (firstCompany) {
        return toCompanyAnalysisTarget(firstCompany, normalizedRawQuery);
      }
    } catch {
    }

    return null;
  }

  async function runCompanyAnalysis(
    company: CompanySearchResult | CompanySearchItem | CompanyAnalysisTarget
  ) {
    const rawQuery =
      "name" in company
        ? getCompanyDisplayName(company) || trimmedQuery
        : "corpName" in company
        ? company.corpName
        : company.keyword;

    if (!rawQuery.trim() || isRunningAnalysis) return;

    setHasUserInteracted(false);
    setAnalysisStatus("loading");
    setAnalysisMessage("기업 정보를 검색하는 중입니다...");
    setIsRunningAnalysis(true);
    setBackendStatus("requesting");
    setDataSource("none");

    const startedAt = Date.now();
    const target =
      "name" in company
        ? toCompanyAnalysisTarget(company, rawQuery)
        : "corpName" in company
        ? {
            keyword: company.keyword || company.corpName,
            corpCode: company.corpCode,
            stockCode: company.stockCode,
            displayName: company.displayName ?? company.corpName,
          }
        : company.corpCode || company.stockCode
        ? company
        : await resolveCompanyTargetFromQuery(rawQuery);

    if (!target) {
      await waitForMinimumDuration(startedAt);
      setAnalysisStatus("error");
      setAnalysisMessage(
        "검색 결과가 없습니다. 회사명을 다시 확인하거나 다른 키워드로 검색해 주세요."
      );
      setIsRunningAnalysis(false);
      setBackendStatus("idle");
      setDataSource("none");
      setIsOpen(true);
      setHasUserInteracted(true);
      return;
    }

    const displayName = target.displayName ?? target.keyword;

    setIsOpen(false);
    setQuerySilently(displayName);

    await waitForMinimumDuration(startedAt);

    setAnalysisStatus("success");
    setAnalysisMessage("");
    setIsRunningAnalysis(false);
    onSelect(toSearchResultFromTarget(target));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedQuery || isRunningAnalysis) return;

    setHasUserInteracted(true);

    const firstVisibleItem = visibleItems[0];

    if (firstVisibleItem) {
      void runCompanyAnalysis(firstVisibleItem);
      return;
    }

    void (async () => {
      const response = await runSearch(trimmedQuery);
      if (!response) return;

      const candidates = [
        ...response.results,
        ...(response.suggestions ?? []),
      ];
      const firstCompany = findBestCompanySearchMatch(candidates, trimmedQuery);

      if (firstCompany) {
        await runCompanyAnalysis(firstCompany);
        return;
      }

      setAnalysisStatus("error");
      setAnalysisMessage(
        "검색 결과가 없습니다. 회사명을 다시 확인하거나 다른 키워드로 검색해 주세요."
      );
      setIsOpen(true);
    })();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);

      if (visibleItems.length === 0) return;

      setHighlightedIndex((prev) =>
        prev < 0 ? 0 : (prev + 1) % visibleItems.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);

      if (visibleItems.length === 0) return;

      setHighlightedIndex((prev) =>
        prev <= 0 ? visibleItems.length - 1 : prev - 1
      );
      return;
    }

    if (event.key === "Enter") {
      const highlightedCompany = visibleItems[effectiveHighlightedIndex];

      if (isOpen && highlightedCompany) {
        event.preventDefault();
        void runCompanyAnalysis(highlightedCompany);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className={containerClassName}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-sky-500" />
          <input
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              setIsOpen(true);
              setHighlightedIndex(-1);

              if (!nextValue.trim()) {
                setIsOpen(false);
                reset();
              }
            }}
            onFocus={() => {
              if (hasUserInteracted && trimmedQuery) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={shouldShowDropdown}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            placeholder={placeholder}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
          )}
        </div>
        <Button
          type="submit"
          disabled={!trimmedQuery || isRunningAnalysis}
          size="md"
          className="w-full shrink-0 sm:w-auto"
        >
          {isRunningAnalysis ? "검색 중" : "검색"}
        </Button>
      </form>

      {shouldShowShortAliasHelp && (
        <p className="mt-2 max-w-full break-words text-xs leading-relaxed text-slate-500">
          SK, LS, GS처럼 짧은 검색어는 대표 기업이 먼저 표시돼요. 계열사는 자동완성 목록에서 직접 선택해 주세요.
        </p>
      )}

      {analysisMessage && (
        <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-2">
          <InlineStatusMessage
            variant={isRunningAnalysis ? "loading" : "info"}
          >
            {analysisMessage}
          </InlineStatusMessage>
        </div>
      )}

      {shouldShowDropdown && (
        <CompanyAutocompleteDropdown
          id={listboxId}
          query={trimmedQuery}
          status={status}
          results={results}
          suggestions={suggestions}
          errorMessage={errorMessage}
          highlightedIndex={effectiveHighlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={(company) => void runCompanyAnalysis(company)}
        />
      )}
    </div>
  );
}
