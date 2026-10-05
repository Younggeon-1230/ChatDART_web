import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { formatPercent, formatSignedPercent } from "@/lib/format";
import type { SectorComparisonItem } from "@/lib/sectorComparison";

type SectorComparisonSectionProps = {
  items: SectorComparisonItem[];
  sampleSize: number | null;
};

function formatMetricValue(item: SectorComparisonItem, value: number) {
  return item.signed
    ? formatSignedPercent(value, 1)
    : formatPercent(value, 1);
}

export default function SectorComparisonSection({
  items,
  sampleSize,
}: SectorComparisonSectionProps) {
  if (items.length === 0) return null;

  return (
    <Box className="max-w-full overflow-hidden p-4 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>업종 비교</SectionLabel>
          <p className="mt-2 break-words text-sm leading-6 text-slate-500">
            제공된 업종 평균과 회사의 현재 지표를 비교합니다.
          </p>
        </div>
        {sampleSize !== null && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            평균 표본 {sampleSize}개
          </span>
        )}
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.key}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4"
          >
            <h3 className="break-words text-sm font-semibold text-slate-950">
              {item.label}
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <dt className="shrink-0 text-slate-500">회사</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-slate-950">
                  {formatMetricValue(item, item.companyValue)}
                </dd>
              </div>
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <dt className="shrink-0 text-slate-500">업종 평균</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-slate-950">
                  {formatMetricValue(item, item.sectorAverage)}
                </dd>
              </div>
            </dl>
            {item.rank !== null && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {item.totalCompanies !== null
                  ? `${item.totalCompanies}개 기업 중 ${item.rank}위`
                  : `업종 내 ${item.rank}위`}
              </p>
            )}
          </article>
        ))}
      </div>
    </Box>
  );
}
