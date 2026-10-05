"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  FileText,
  Search,
  Sparkles,
} from "lucide-react";
import Button from "@/components/common/Button";
import { StatusBadge } from "@/components/common/Badge";
import PageFrame from "@/components/financial/PageFrame";
import Box from "@/components/financial/Box";
import CompanySearchBar, {
  type CompanySearchResult,
} from "@/components/financial/CompanySearchBar";
import { buildCompanyAnalysisUrl } from "@/lib/companySearch";

const QUICK_COMPANIES = ["삼성전자", "SK하이닉스", "NAVER", "카카오", "현대자동차"];

const FEATURE_CARDS = [
  {
    title: "3줄 요약",
    description: "기업 재무 상태를 핵심 문장으로 빠르게 확인합니다.",
    icon: FileText,
  },
  {
    title: "상세 분석",
    description: "성장성, 수익성, 안정성 지표와 원본 재무제표를 함께 봅니다.",
    icon: BarChart3,
  },
  {
    title: "기업 비교",
    description: "여러 기업의 주요 지표와 그래프를 한 화면에서 비교합니다.",
    icon: ArrowRightLeft,
  },
  {
    title: "AI 리포트",
    description: "지원되는 기업은 자연어 분석과 예측 요약을 함께 확인합니다.",
    icon: Sparkles,
  },
];

export default function HomePage() {
  const router = useRouter();

  function handleCompanySelect(company: CompanySearchResult) {
    router.push(buildCompanyAnalysisUrl("/summary", company));
  }

  function moveToSummary(companyName: string) {
    router.push(
      buildCompanyAnalysisUrl("/summary", {
        keyword: companyName,
        displayName: companyName,
      })
    );
  }

  return (
    <PageFrame
      title="메인"
      description="기업명을 입력하면 재무 분석을 시작합니다."
      icon={Building2}
      hideHeader
    >
      <section className="flex min-h-[calc(100vh-3rem)] items-center justify-center py-6 sm:py-8 md:min-h-[calc(100vh-4rem)] md:pb-12 md:pt-6">
        <Box className="relative w-full max-w-6xl overflow-visible px-5 py-8 sm:px-8 sm:py-12 md:px-12 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <StatusBadge tone="neutral" className="mb-4">
              Financial Statement Analysis
            </StatusBadge>

            <h1 className="bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
              ChatDART
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              어렵고 방대한 기업 재무제표, 이제 쉽게 확인해보세요.
              <br />
              ChatDART가 AI 요약과 분석으로 꼭 필요한 핵심 정보를 친절하게
              정리해드립니다.
            </p>

            <CompanySearchBar
              className="mx-auto mt-8 max-w-2xl text-left"
              onSelect={handleCompanySelect}
              placeholder="기업명을 입력하세요"
            />

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {QUICK_COMPANIES.map((company) => (
                <Button
                  key={company}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveToSummary(company)}
                  className="bg-white/80"
                >
                  <Search className="h-3.5 w-3.5" />
                  {company}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_CARDS.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="min-w-0 rounded-xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/80 p-4 text-left shadow-sm shadow-sky-100/40 transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-sky-100">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-950">
                  {title}
                </h2>
                <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>

        </Box>
      </section>
    </PageFrame>
  );
}
