"use client";

import { InlineStatusMessage } from "@/components/common/StatusState";
import CompanyAutocompleteItem from "@/components/financial/CompanyAutocompleteItem";
import type { CompanySearchStatus } from "@/hooks/useCompanySearch";
import type { CompanySearchItem } from "@/lib/companySearch";
import { STATUS_MESSAGES } from "@/lib/statusMessages";

type CompanyAutocompleteDropdownProps = {
  id: string;
  query: string;
  status: CompanySearchStatus;
  results: CompanySearchItem[];
  suggestions: CompanySearchItem[];
  errorMessage: string;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (company: CompanySearchItem) => void;
};

export default function CompanyAutocompleteDropdown({
  id,
  query,
  status,
  results,
  suggestions,
  errorMessage,
  highlightedIndex,
  onHighlight,
  onSelect,
}: CompanyAutocompleteDropdownProps) {
  const hasResults = results.length > 0;
  const visibleItems = hasResults ? results : suggestions;
  const showSuggestionHeading = !hasResults && suggestions.length > 0;

  return (
    <div
      id={id}
      role="listbox"
      aria-label={`${query} 기업 자동완성`}
      className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    >
      {status === "loading" && (
        <div className="px-4 py-3">
          <InlineStatusMessage variant="loading">
            {STATUS_MESSAGES.searchLoading}
          </InlineStatusMessage>
        </div>
      )}

      {status === "error" && (
        <div className="px-4 py-3">
          <InlineStatusMessage variant="error">
            {errorMessage || STATUS_MESSAGES.autocompleteError}
          </InlineStatusMessage>
        </div>
      )}

      {status === "empty" && (
        <div className="px-4 py-3">
          <InlineStatusMessage variant="empty">
            {STATUS_MESSAGES.searchEmpty}
          </InlineStatusMessage>
        </div>
      )}

      {showSuggestionHeading && (
        <div className="border-t border-slate-100 px-4 pb-1 pt-3 text-xs font-medium text-slate-500">
          혹시 이 기업을 찾으셨나요?
        </div>
      )}

      {visibleItems.slice(0, 8).map((company, index) => (
        <CompanyAutocompleteItem
          key={`${company.name}-${company.stockCode ?? company.corpCode ?? index}`}
          id={`${id}-option-${index}`}
          company={company}
          isHighlighted={index === highlightedIndex}
          onHighlight={() => onHighlight(index)}
          onSelect={() => onSelect(company)}
        />
      ))}
    </div>
  );
}
