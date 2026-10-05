"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { StatusState } from "@/components/common/StatusState";
import Box from "@/components/financial/Box";
import PageFrame from "@/components/financial/PageFrame";
import { ComparePageContent } from "@/app/compare/ComparePageContent";
import {
  getApiErrorStatus,
  getCompareShare,
  getUserFriendlyApiErrorMessage,
} from "@/lib/api";
import { isValidCompareShareId } from "@/lib/compareShare";
import { normalizeCompanySummaryResponse } from "@/lib/financialNormalize";
import type { CompanySummaryApiResponse } from "@/types/api";

type ShareCompanyLike = {
  stock_code?: unknown;
  stockCode?: unknown;
  code?: unknown;
  company_name?: unknown;
  companyName?: unknown;
  name?: unknown;
  keyword?: unknown;
  companyId?: unknown;
};

function cleanShareValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function toShareCompanyKeyword(company: unknown) {
  if (!company || typeof company !== "object") {
    return "";
  }

  const item = company as ShareCompanyLike;

  return (
    cleanShareValue(item.stock_code) ||
    cleanShareValue(item.stockCode) ||
    cleanShareValue(item.code) ||
    cleanShareValue(item.company_name) ||
    cleanShareValue(item.companyName) ||
    cleanShareValue(item.name) ||
    cleanShareValue(item.keyword) ||
    cleanShareValue(item.companyId)
  );
}

function extractShareKeywords(response: unknown) {
  if (!response || typeof response !== "object") {
    return [];
  }

  const record = response as Record<string, unknown>;
  const companies = Array.isArray(record.companies) ? record.companies : [];
  const keywords = Array.isArray(record.keywords) ? record.keywords : [];
  const candidateValues = [
    ...companies.map(toShareCompanyKeyword),
    ...keywords.map(cleanShareValue),
    toShareCompanyKeyword(record.leftCompany),
    toShareCompanyKeyword(record.rightCompany),
  ].filter(Boolean);

  return [...new Set(candidateValues)].slice(0, 3);
}

function extractShareCompanies(response: unknown) {
  if (!response || typeof response !== "object") {
    return [];
  }

  const record = response as Record<string, unknown>;
  if (!Array.isArray(record.companies)) {
    return [];
  }

  return record.companies
    .map((company) => {
      const keyword = toShareCompanyKeyword(company);
      return normalizeCompanySummaryResponse(company, keyword);
    })
    .filter((company) => company.company_name && company.history.length > 0)
    .slice(0, 3);
}

function getSharePageErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 404) {
    return "공유 링크가 없거나 만료되었습니다.";
  }

  if (status === 422) {
    return "잘못된 공유 링크 형식입니다.";
  }

  if (status === 408 || error instanceof TypeError) {
    return "연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.";
  }

  return getUserFriendlyApiErrorMessage(
    error,
    "공유 링크를 불러오지 못했습니다."
  );
}

export default function CompareSharePage() {
  const params = useParams<{ share_id: string }>();
  const shareId = params.share_id;
  const [status, setStatus] = useState<
    "loading" | "error" | "empty" | "ready"
  >("loading");
  const [errorText, setErrorText] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [companies, setCompanies] = useState<CompanySummaryApiResponse[]>([]);

  const isValidShareId = useMemo(
    () => isValidCompareShareId(shareId),
    [shareId]
  );

  useEffect(() => {
    if (!isValidShareId) {
      return;
    }

    let isMounted = true;

    async function loadShare() {
      try {
        setStatus("loading");
        setErrorText("");
        setKeywords([]);
        setCompanies([]);

        const response = await getCompareShare(shareId);
        const nextCompanies = extractShareCompanies(response);
        const nextKeywords =
          nextCompanies.length >= 2
            ? nextCompanies.map(
                (company) => company.stock_code || company.company_name
              )
            : extractShareKeywords(response);

        if (!isMounted) return;

        if (nextKeywords.length < 2) {
          setStatus("empty");
          return;
        }

        setKeywords(nextKeywords);
        setCompanies(nextCompanies);
        setStatus("ready");
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        setErrorText(getSharePageErrorMessage(error));
      }
    }

    void loadShare();

    return () => {
      isMounted = false;
    };
  }, [isValidShareId, shareId]);

  if (!isValidShareId) {
    return (
      <PageFrame
        title="공유 비교 링크"
        description="저장된 기업 비교 조합을 불러옵니다."
        icon={ArrowRightLeft}
      >
        <div className="mx-auto max-w-3xl">
          <Box className="p-6">
            <StatusState
              variant="error"
              title="공유 링크를 열 수 없습니다"
              description="잘못된 공유 링크 형식입니다."
            />
          </Box>
        </div>
      </PageFrame>
    );
  }

  if (status === "ready") {
    return (
      <Suspense fallback={null}>
        <ComparePageContent
          initialCompanyNames={keywords}
          initialCompanyData={companies}
          isPublicShare
        />
      </Suspense>
    );
  }

  return (
    <PageFrame
      title="공유 비교 링크"
      description="저장된 기업 비교 조합을 불러옵니다."
      icon={ArrowRightLeft}
    >
      <div className="mx-auto max-w-3xl">
        <Box className="p-6">
          {status === "loading" && (
            <StatusState
              variant="loading"
              title="공유 비교 정보를 불러오는 중입니다"
              description="저장된 비교 기업 조합을 확인하고 있습니다."
            />
          )}

          {status === "empty" && (
            <StatusState
              variant="empty"
              title="비교할 기업을 찾지 못했습니다"
              description="공유 링크에는 2개 이상의 비교 기업 정보가 필요합니다."
            />
          )}

          {status === "error" && (
            <StatusState
              variant="error"
              title="공유 링크를 열 수 없습니다"
              description={errorText}
            />
          )}
        </Box>
      </div>
    </PageFrame>
  );
}
