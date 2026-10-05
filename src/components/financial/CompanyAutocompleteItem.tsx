"use client";

import type { CompanySearchItem } from "@/lib/companySearch";

type CompanyAutocompleteItemProps = {
  company: CompanySearchItem;
  id: string;
  isHighlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
};

export default function CompanyAutocompleteItem({
  company,
  id,
  isHighlighted,
  onHighlight,
  onSelect,
}: CompanyAutocompleteItemProps) {
  const collectionBadge =
    company.isCollected === true
      ? {
          label: "수집됨",
          className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
        }
      : company.isCollected === false
      ? {
          label: "수집 필요",
          className: "bg-amber-50 text-amber-700 ring-amber-100",
        }
      : null;
  const metaItems = [
    company.stockCode,
    company.market,
    company.industry,
    company.business,
  ].filter(Boolean);

  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onHighlight}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
        isHighlighted ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-slate-900">
            {company.name}
          </span>
          {collectionBadge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${collectionBadge.className}`}
            >
              {collectionBadge.label}
            </span>
          )}
        </span>
        {metaItems.length > 0 && (
          <span className="mt-1 block truncate text-xs text-slate-500">
            {metaItems.join(" · ")}
          </span>
        )}
      </span>
    </button>
  );
}
