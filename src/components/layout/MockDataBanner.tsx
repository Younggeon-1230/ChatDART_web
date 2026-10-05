"use client";

import { useDataSource } from "@/components/layout/DataSourceProvider";

export default function MockDataBanner() {
  const { backendStatus, dataSource, isRunningAnalysis } = useDataSource();
  const shouldShowMockBanner =
    dataSource === "mock" &&
    backendStatus === "fallback-mock" &&
    !isRunningAnalysis;

  if (!shouldShowMockBanner) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-full truncate rounded-lg border border-amber-100 bg-white/90 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm shadow-amber-100/50">
        일부 정보는 예시 데이터로 표시됩니다
      </div>
    </div>
  );
}
