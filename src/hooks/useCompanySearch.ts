"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CompanySearchItem,
  normalizeCompanyQuery,
  searchCompanies,
} from "@/lib/companySearch";

export type AutocompleteStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";
export type CompanySearchStatus = AutocompleteStatus;
export type AnalysisStatus = "idle" | "loading" | "success" | "error";

type UseCompanySearchOptions = {
  initialQuery?: string;
  debounceMs?: number;
};

export function useCompanySearch({
  initialQuery = "",
  debounceMs = 250,
}: UseCompanySearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<AutocompleteStatus>("idle");
  const [results, setResults] = useState<CompanySearchItem[]>([]);
  const [suggestions, setSuggestions] = useState<CompanySearchItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const requestIdRef = useRef(0);

  const normalizedQuery = useMemo(() => normalizeCompanyQuery(query), [query]);
  const isLoading = status === "loading";

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setStatus("idle");
    setResults([]);
    setSuggestions([]);
    setErrorMessage("");
  }, []);

  const runSearch = useCallback(async (nextQuery = query) => {
    const normalized = normalizeCompanyQuery(nextQuery);

    if (!normalized.collapsed) {
      reset();
      return null;
    }

    setStatus("loading");
    setErrorMessage("");
    setResults([]);
    setSuggestions([]);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const response = await searchCompanies(normalized.collapsed);

      if (requestId !== requestIdRef.current) {
        return null;
      }

      const nextResults = response.results;
      const nextSuggestions = response.suggestions ?? [];

      setResults(nextResults);
      setSuggestions(nextSuggestions);
      setStatus(
        nextResults.length > 0 || nextSuggestions.length > 0
          ? "success"
          : "empty"
      );

      return response;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return null;
      }

      setResults([]);
      setSuggestions([]);
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "검색 결과를 불러오지 못했습니다."
      );
      return null;
    }
  }, [query, reset]);

  const updateQuery = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery);
      setHasUserInteracted(true);
      setResults([]);
      setSuggestions([]);
      setErrorMessage("");

      if (!normalizeCompanyQuery(nextQuery).collapsed) {
        reset();
      }
    },
    [reset]
  );

  useEffect(() => {
    if (!hasUserInteracted || !normalizedQuery.collapsed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(normalizedQuery.collapsed);
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    debounceMs,
    hasUserInteracted,
    normalizedQuery.collapsed,
    runSearch,
  ]);

  return {
    query,
    setQuery: updateQuery,
    setQuerySilently: setQuery,
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
  };
}
