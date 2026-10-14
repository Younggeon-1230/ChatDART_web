import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { formatPercent, formatSignedPercent } from "@/lib/format";
import {
  getSectorComparisonValueTone,
  type SectorComparisonItem,
  type SectorComparisonValueTone,
} from "@/lib/sectorComparison";

type SectorComparisonSectionProps = {
  items: SectorComparisonItem[];
  sampleSize: number | null;
};

function formatMetricValue(item: SectorComparisonItem, value: number) {
  return item.signed
    ? formatSignedPercent(value, 1)
    : formatPercent(value, 1);
}

const COMPANY_VALUE_TONE_CLASS: Record<
  SectorComparisonValueTone,
  string
> = {
  positive: "text-emerald-700",
  caution: "text-amber-700",
  neutral: "text-slate-950",
};

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

      <div className="mt-5 grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const companyValueTone = getSectorComparisonValueTone(
            item.key,
            item.companyValue,
            item.sectorAverage
          );

          return (
            <article
              key={item.key}
              className="h-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4"
            >
              <h3 className="break-words text-sm font-semibold text-slate-950">
                {item.label}
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-slate-500">회사</dt>
                  <dd
                    className={`min-w-0 break-words text-right font-semibold ${COMPANY_VALUE_TONE_CLASS[companyValueTone]}`}
                  >
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
            </article>
          );
        })}
      </div>
    </Box>
  );
}
