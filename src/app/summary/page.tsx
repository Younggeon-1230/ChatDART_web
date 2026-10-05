"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import Button from "@/components/common/Button";
import ScrollTopButton from "@/components/common/ScrollTopButton";
import { StatusState } from "@/components/common/StatusState";
import PageFrame from "@/components/financial/PageFrame";
import AiReportSlot, {
  type AiReportStatus,
} from "@/components/financial/AiReportSlot";
import RelatedCompanyList from "@/components/financial/RelatedCompanyList";
import MetricCard from "@/components/financial/MetricCard";
import Box from "@/components/financial/Box";
import CompanySearchBar, {
  type CompanySearchResult,
} from "@/components/financial/CompanySearchBar";
import { useDataSource } from "@/components/layout/DataSourceProvider";
import SectionLabel from "@/components/financial/SectionLabel";
import type { CompanySummaryResponse } from "@/types/financial";
import {
  SUMMARY_TIMEOUT_MS,
  ENABLE_AI_ANALYSIS,
  getAiAnalysis,
  getAiAnalysisErrorMessage,
  getFinanceServiceUnavailableKind,
  getApiErrorStatus,
  getCollectionStatus,
  getSummaryDetail,
  getUserFriendlyApiErrorMessage,
  isRateLimitError,
  startCollection,
} from "@/lib/api";
import {
  type CompanyAnalysisTarget,
  buildCompanyAnalysisUrl,
} from "@/lib/companySearch";
import { buildLoginHref } from "@/lib/authRedirect";
import { addRecentCompany } from "@/lib/recentCompanies";
import { transformSummaryApiToUi } from "@/lib/transform";
import { STATUS_MESSAGES } from "@/lib/statusMessages";
import { getFinancialStatusTextClass } from "@/lib/financialStatusStyle";
import type { AiAnalysisResponse } from "@/types/api";
import {
  getInitialSummaryAction,
  isTerminalSummaryPollResult,
  probeSummaryCollectionState,
  retryFailedSummaryCollection,
  type SummaryPollResult,
} from "@/lib/summaryCollectionFlow";

type PageState =
  | "idle"
  | "collecting"
  | "polling"
  | "fetching_summary"
  | "completed"
  | "collection_failed"
  | "timeout"
  | "error";

type AiReportViewState = {
  status: AiReportStatus;
  analysis: AiAnalysisResponse | null;
  errorText: string;
};

const POLLING_INTERVAL_MS = 1500;
const MAX_STATUS_CHECK_COUNT = 40;
const POLLING_TIMEOUT_MESSAGE =
  "아직 수집이 완료되지 않았습니다. 시간이 오래 걸리면 잠시 후 다시 검색하거나 새로고침해 주세요.";
const PROCESSING_STATUS_MESSAGE =
  "해당 기업의 재무 데이터를 준비하고 있습니다. 완료되면 자동으로 다시 불러옵니다.";
const PROCESSING_STATUS_HELP_MESSAGE =
  "잠시 후 자동으로 다시 확인합니다. 시간이 오래 걸리면 새로고침하거나 다시 검색해 주세요.";
const RATE_LIMIT_COOLDOWN_SECONDS = 60;

function waitForPollingInterval() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, POLLING_INTERVAL_MS);
  });
}

type ProgressStep = {
  label: string;
  done: boolean;
  active: boolean;
};

type AiSummarySectionProps = {
  lines: string[];
  sourceReport?: string;
};

function ProgressSteps({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step) => (
        <div
          key={step.label}
          className={`rounded-lg border px-4 py-4 text-left transition ${
            step.active
              ? "border-slate-900 bg-slate-900 text-white"
              : step.done
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : "border-slate-200 bg-white text-slate-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : step.active ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-current opacity-60" />
            )}
            <span className="text-sm font-medium">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiSummarySection({
  lines,
  sourceReport,
}: AiSummarySectionProps) {
  return (
    <Box className="p-5">
      <SectionLabel>재무제표 기반 3줄 요약</SectionLabel>
      <div className="min-h-[240px] rounded-lg border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-inner shadow-sky-100/50 sm:p-6">
        <div className="space-y-4 text-sm leading-7 text-slate-700 sm:text-[15px]">
          {lines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>

        {sourceReport && (
          <div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500">
            <span className="font-medium text-slate-600">출처:</span>{" "}
            {sourceReport}
          </div>
        )}
      </div>
    </Box>
  );
}

function SummaryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const corpCode = searchParams.get("corpCode")?.trim() || undefined;
  const stockCode = searchParams.get("stockCode")?.trim() || undefined;
  const displayName = searchParams.get("displayName")?.trim() || undefined;
  const analysisTarget = useMemo<CompanyAnalysisTarget>(
    () => ({
      keyword,
      corpCode,
      stockCode,
      displayName,
    }),
    [corpCode, displayName, keyword, stockCode]
  );

  const [pageState, setPageState] = useState<PageState>("idle");
  const [summary, setSummary] = useState<CompanySummaryResponse | null>(null);
  const [message, setMessage] = useState("기업을 검색해 주세요.");
  const [errorText, setErrorText] = useState("");
  const [errorStatus, setErrorStatus] = useState<number>();
  const [cooldown, setCooldown] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [summaryElapsedSeconds, setSummaryElapsedSeconds] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetryingCollection, setIsRetryingCollection] = useState(false);
  const [aiReportState, setAiReportState] = useState<AiReportViewState>({
    status: "disabled",
    analysis: null,
    errorText: "",
  });
  const {
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
  } = useDataSource();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestingSummaryRef = useRef(false);
  const statusCheckCountRef = useRef(0);
  const activeRequestKeyRef = useRef("");
  const collectionRetryLockRef = useRef(false);

  const cards = useMemo(() => {
    if (!summary) return [];

    return [
      {
        title: "성장성",
        value: summary.growth.label,
        desc: summary.growth.description,
      },
      {
        title: "안정성",
        value: summary.stability.label,
        desc: summary.stability.description,
      },
      {
        title: "수익성",
        value: summary.profitability.label,
        desc: summary.profitability.description,
      },
    ];
  }, [summary]);

  const progressSteps = useMemo<ProgressStep[]>(() => {
    return [
      {
        label: "데이터 수집 요청",
        done:
          pageState === "polling" ||
          pageState === "fetching_summary" ||
          pageState === "completed",
        active: pageState === "collecting",
      },
      {
        label: "분석 상태 확인",
        done:
          pageState === "fetching_summary" || pageState === "completed",
        active: pageState === "polling",
      },
      {
        label: "요약 결과 불러오기",
        done: pageState === "completed",
        active: pageState === "fetching_summary",
      },
    ];
  }, [pageState]);

  const isInProgress =
    !!keyword &&
    pageState !== "completed" &&
    pageState !== "idle" &&
    pageState !== "timeout" &&
    pageState !== "collection_failed" &&
    pageState !== "error";

  const showFloatingDetailButton =
    !!keyword && !!summary && pageState === "completed";

  useEffect(() => {
    if (pageState !== "fetching_summary") {
      setSummaryElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setSummaryElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [pageState]);

  useEffect(() => {
    let isMounted = true;

    if (!ENABLE_AI_ANALYSIS || pageState !== "completed" || !summary) {
      setAiReportState({
        status: "disabled",
        analysis: null,
        errorText: "",
      });
      return;
    }

    const aiKeyword = summary.companyId || keyword;

    async function loadAiReport() {
      try {
        setAiReportState({
          status: "loading",
          analysis: null,
          errorText: "",
        });

        const response = await getAiAnalysis(aiKeyword);

        if (!isMounted) return;

        setAiReportState({
          status: "success",
          analysis: response,
          errorText: "",
        });
      } catch (error) {
        if (!isMounted) return;

        setAiReportState({
          status: "error",
          analysis: null,
          errorText: getAiAnalysisErrorMessage(error),
        });
      }
    }

    void loadAiReport();

    return () => {
      isMounted = false;
    };
  }, [keyword, pageState, summary]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isRequestingSummaryRef.current = false;
    statusCheckCountRef.current = 0;
  }, []);

  const clearCooldown = useCallback(() => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  }, []);

  function formatUpdatedAt(value?: string | null) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("ko-KR");
  }

  const resetPage = useCallback(() => {
    clearPolling();
    clearCooldown();
    setSummary(null);
    setErrorText("");
    setErrorStatus(undefined);
    setCooldown(0);
    setUpdatedAt("");
    setMessage("데이터 수집을 시작합니다.");
  }, [clearCooldown, clearPolling]);

  const startCooldown = useCallback((seconds = RATE_LIMIT_COOLDOWN_SECONDS) => {
    setCooldown(seconds);

    clearCooldown();

    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearCooldown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCooldown]);

  const applyError = useCallback((error: unknown, fallbackMessage: string) => {
    const status = getApiErrorStatus(error);
    const message = getUserFriendlyApiErrorMessage(error, fallbackMessage);

    setPageState("error");
    setDataSource("none");
    setBackendStatus(status === 408 ? "timeout" : "failed");
    setIsRunningAnalysis(false);
    setErrorStatus(status);

    if (isRateLimitError(error)) {
      startCooldown();
    }

    setErrorText(message);
  }, [
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
    startCooldown,
  ]);

  const handleRetrySearch = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  const handleRetryFailedCollection = useCallback(async () => {
    const requestKey = activeRequestKeyRef.current;
    if (!requestKey || collectionRetryLockRef.current) return;

    setIsRetryingCollection(true);
    setErrorText("");
    setErrorStatus(undefined);
    setBackendStatus("requesting");
    setIsRunningAnalysis(true);

    try {
      const result = await retryFailedSummaryCollection(
        analysisTarget,
        startCollection,
        collectionRetryLockRef
      );

      if (
        result.kind === "skipped" ||
        activeRequestKeyRef.current !== requestKey
      ) {
        return;
      }

      setPageState("polling");
      setMessage(
        result.response.message ??
          (result.response.status === "already_processing"
            ? "이미 수집이 진행 중입니다. 완료되면 자동으로 다시 불러옵니다."
            : `"${keyword}" 데이터를 분석하는 중입니다.`)
      );
      setRetryCount((prev) => prev + 1);
    } catch (error) {
      if (activeRequestKeyRef.current !== requestKey) return;
      applyError(error, "재수집 요청 중 오류가 발생했습니다.");
    } finally {
      setIsRetryingCollection(false);
    }
  }, [
    analysisTarget,
    applyError,
    keyword,
    setBackendStatus,
    setIsRunningAnalysis,
  ]);

  useEffect(() => {
    return () => {
      clearPolling();
      clearCooldown();
    };
  }, [clearCooldown, clearPolling]);

  useEffect(() => {
    let isActive = true;
    const requestKey = JSON.stringify({
      keyword,
      corpCode,
      stockCode,
      displayName,
    });
    activeRequestKeyRef.current = requestKey;
    const isCurrentRequest = () =>
      isActive && activeRequestKeyRef.current === requestKey;

    if (!keyword) {
      setPageState("idle");
      setSummary(null);
      setMessage("기업을 검색해 주세요.");
      setErrorText("");
      setErrorStatus(undefined);
      setUpdatedAt("");
      setDataSource("none");
      setBackendStatus("idle");
      setIsRunningAnalysis(false);
      activeRequestKeyRef.current = "";
      clearPolling();
      clearCooldown();
      return;
    }

    resetPage();

    function applyCompletedSummary(
      detailResponse: Awaited<ReturnType<typeof getSummaryDetail>>
    ) {
      setPageState("fetching_summary");
      setSummaryElapsedSeconds(0);
      setMessage(
        `요약 결과를 불러오는 중입니다. 최대 ${Math.round(
          SUMMARY_TIMEOUT_MS / 1000
        )}초까지 기다릴 수 있습니다.`
      );

      const summaryResponse = detailResponse.summary;
      const transformed = transformSummaryApiToUi(summaryResponse);

      if (!isCurrentRequest()) return;

      if (detailResponse.collection_updated_at) {
        setUpdatedAt(formatUpdatedAt(detailResponse.collection_updated_at));
      }

      if (detailResponse.__dataSource === "mock") {
        setDataSource("mock");
        setBackendStatus("fallback-mock");
      } else {
        setDataSource(detailResponse.__dataSource ?? "api");
        setBackendStatus("success");
      }
      setIsRunningAnalysis(false);

      addRecentCompany({
        name: summaryResponse.company_name,
        stockCode: summaryResponse.stock_code,
      });
      setSummary(transformed);
      setPageState("completed");
      setMessage("분석이 완료되었습니다.");
    }

    async function pollIntegratedSummary(): Promise<SummaryPollResult> {
      if (isRequestingSummaryRef.current || !isCurrentRequest()) return "pending";
      isRequestingSummaryRef.current = true;

      try {
        statusCheckCountRef.current += 1;
        const pollResult = await probeSummaryCollectionState(analysisTarget, {
          getSummaryDetail,
          getCollectionStatus,
        });

        if (!isCurrentRequest()) return "error";

        const collectionUpdatedAt =
          pollResult.kind === "completed"
            ? pollResult.detail.collection_updated_at
            : pollResult.kind === "pending"
            ? pollResult.collectionUpdatedAt
            : null;

        if (collectionUpdatedAt) {
          const nextUpdatedAt = formatUpdatedAt(collectionUpdatedAt);
          const collectedAtSource =
            pollResult.kind === "completed"
              ? pollResult.detail.__dataSource ?? "api"
              : "api";

          setUpdatedAt((prev) =>
            collectedAtSource === "mock"
              ? "mock 데이터"
              : prev === nextUpdatedAt
              ? prev
              : nextUpdatedAt
          );
        }

        if (pollResult.kind === "needs_collection") {
          if (statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT) {
            clearPolling();
            setPageState("timeout");
            setBackendStatus("timeout");
            setIsRunningAnalysis(false);
            setMessage(POLLING_TIMEOUT_MESSAGE);
            return "timeout";
          }

          setMessage(
            pollResult.message ?? "수집 이력이 없습니다. 다시 수집을 시도합니다."
          );
          return "needs_collection";
        }

        if (
          pollResult.kind === "pending" ||
          pollResult.kind === "retry_detail"
        ) {
          if (statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT) {
            clearPolling();
            setPageState("timeout");
            setBackendStatus("timeout");
            setIsRunningAnalysis(false);
            setMessage(POLLING_TIMEOUT_MESSAGE);
            return "timeout";
          }

          setPageState("polling");
          setMessage(pollResult.message ?? PROCESSING_STATUS_MESSAGE);
          return "pending";
        }

        if (pollResult.kind === "failed") {
          clearPolling();
          setPageState("collection_failed");
          setErrorStatus(undefined);
          setErrorText(
            pollResult.message?.includes("서버 재시작")
              ? "데이터 수집이 중단되었습니다. 다시 검색하거나 잠시 후 다시 시도해 주세요."
              : pollResult.message ?? "수집에 실패했습니다."
          );
          setDataSource("none");
          setBackendStatus("failed");
          setIsRunningAnalysis(false);
          return "failed";
        }

        if (pollResult.kind === "completed") {
          clearPolling();
          applyCompletedSummary(pollResult.detail);
          setMessage(pollResult.detail.message ?? "분석이 완료되었습니다.");
          return "completed";
        }

        throw new Error("지원하지 않는 Summary 폴링 결과입니다.");
      } catch (error) {
        if (!isCurrentRequest()) return "error";
        if (
          getFinanceServiceUnavailableKind(error) === "loading" &&
          statusCheckCountRef.current < MAX_STATUS_CHECK_COUNT
        ) {
          setPageState("polling");
          setBackendStatus("requesting");
          setMessage(getUserFriendlyApiErrorMessage(error));
          return "pending";
        }

        clearPolling();
        applyError(error, "상태 확인 중 오류가 발생했습니다.");
        return "error";
      } finally {
        isRequestingSummaryRef.current = false;
      }
    }

    async function run() {
      try {
        setPageState("fetching_summary");
        setDataSource("none");
        setBackendStatus("requesting");
        setIsRunningAnalysis(true);
        setMessage(`"${keyword}" 데이터 수집을 시작합니다.`);

        const initialPollResult = await pollIntegratedSummary();

        if (!isCurrentRequest()) return;

        const initialAction = getInitialSummaryAction(initialPollResult);

        if (initialAction === "poll") {
          pollingRef.current = setInterval(() => {
            void pollIntegratedSummary();
          }, POLLING_INTERVAL_MS);
          return;
        }

        if (initialAction !== "collect") return;

        setPageState("collecting");

        let collectResponse: Awaited<ReturnType<typeof startCollection>> | null =
          null;

        while (isCurrentRequest() && !collectResponse) {
          try {
            collectResponse = await startCollection(analysisTarget);
          } catch (error) {
            if (
              getFinanceServiceUnavailableKind(error) !== "loading" ||
              statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT
            ) {
              throw error;
            }

            statusCheckCountRef.current += 1;
            setPageState("polling");
            setBackendStatus("requesting");
            setMessage(getUserFriendlyApiErrorMessage(error));
            await waitForPollingInterval();
          }
        }

        if (!isCurrentRequest()) return;
        if (!collectResponse) return;

        if (
          collectResponse.status === "started" ||
          collectResponse.status === "already_processing"
        ) {
          setPageState("polling");
          setMessage(
            collectResponse.message ??
              (collectResponse.status === "already_processing"
                ? "이미 수집이 진행 중입니다. 완료되면 자동으로 다시 불러옵니다."
                : `"${keyword}" 데이터를 분석하는 중입니다.`)
          );

          const nextPollResult = await pollIntegratedSummary();

          if (!isCurrentRequest() || isTerminalSummaryPollResult(nextPollResult)) {
            return;
          }

          pollingRef.current = setInterval(() => {
            void pollIntegratedSummary();
          }, POLLING_INTERVAL_MS);
        }
      } catch (error) {
        if (!isCurrentRequest()) return;
        applyError(error, "요청 처리 중 오류가 발생했습니다.");
      }
    }

    void run();

    return () => {
      isActive = false;
      if (activeRequestKeyRef.current === requestKey) {
        activeRequestKeyRef.current = "";
      }
      clearPolling();
    };
  }, [
    applyError,
    analysisTarget,
    clearCooldown,
    clearPolling,
    corpCode,
    displayName,
    keyword,
    resetPage,
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
    retryCount,
    stockCode,
  ]);

  function handleCompanySelect(company: CompanySearchResult) {
    router.push(buildCompanyAnalysisUrl("/summary", company));
  }

  const loginHref = buildLoginHref("/summary", searchParams.toString());

  return (
    <PageFrame
      title="3줄 요약"
      description="검색한 기업의 재무 요약을 제시합니다."
      icon={FileText}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(820px,1fr)]">
        <div className={isInProgress ? "opacity-60 transition lg:sticky lg:top-24 lg:self-start" : "transition lg:sticky lg:top-24 lg:self-start"}>
          <RelatedCompanyList title="최근 본 기업" />
        </div>

        <div className="min-w-0 space-y-5 pb-4">
          <CompanySearchBar
            initialKeyword={displayName ?? keyword}
            onSelect={handleCompanySelect}
            placeholder="요약할 기업명 또는 종목코드를 입력하세요"
          />

          {!keyword && (
            <Box className="p-5">
              <StatusState
                variant="info"
                title="분석할 기업을 검색해주세요"
                description="기업명 또는 종목코드를 입력하면 재무 데이터 수집과 요약 생성을 시작합니다."
              />
            </Box>
          )}

          {keyword && isInProgress && (
            <Box className="p-6 md:p-8">
              <div className="flex flex-col">
                <StatusState
                  variant="loading"
                  title="재무 데이터를 수집/분석 중입니다"
                  description={`${displayName ?? keyword} 재무 데이터를 준비하고 있습니다. 완료되면 자동으로 다시 불러옵니다.`}
                />
                <div className="mt-8 w-full">
                  <ProgressSteps steps={progressSteps} />
                </div>

                <div className="mt-8 w-full space-y-3">
                  <StatusState
                    variant="info"
                    compact
                    title="잠시 후 자동으로 다시 확인합니다"
                    description={message}
                  />

                  {pageState === "polling" && (
                    <StatusState
                      variant="info"
                      compact
                      title="시간이 오래 걸리면"
                      description={PROCESSING_STATUS_HELP_MESSAGE}
                    />
                  )}

                  {pageState === "fetching_summary" && (
                    <StatusState
                      variant="loading"
                      compact
                      title={STATUS_MESSAGES.summaryLoading}
                      description={`${summaryElapsedSeconds}초 경과 · 최대 ${Math.round(
                        SUMMARY_TIMEOUT_MS / 1000
                      )}초까지 기다립니다.`}
                    />
                  )}

                  {updatedAt && (
                    <StatusState
                      variant="success"
                      compact
                      title="최근 수집 시간"
                      description={updatedAt}
                    />
                  )}

                  {cooldown > 0 && (
                    <StatusState
                      variant="warning"
                      compact
                      title="잠시 후 다시 시도할 수 있습니다"
                      description={`${cooldown}초 후 다시 가능합니다.`}
                    />
                  )}
                </div>
              </div>
            </Box>
          )}

          {keyword && pageState === "error" && (
            <Box className="p-6 md:p-8">
              <StatusState
                variant="error"
                title={STATUS_MESSAGES.dataError}
                description={errorText || "잠시 후 다시 시도해주세요."}
                action={
                  errorStatus === 401 ? (
                    <Button size="sm" onClick={() => router.push(loginHref)}>
                      로그인하기
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetrySearch}
                    >
                      <RotateCcw className="h-4 w-4" />
                      다시 검색
                    </Button>
                  )
                }
              />
            </Box>
          )}

          {keyword && pageState === "collection_failed" && (
            <Box className="p-6 md:p-8">
              <StatusState
                variant="error"
                title="재무 데이터 수집에 실패했습니다"
                description={
                  errorText ||
                  "데이터를 수집하지 못했습니다. 잠시 후 다시 시도해 주세요."
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleRetryFailedCollection()}
                      disabled={isRetryingCollection}
                    >
                      {isRetryingCollection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      {isRetryingCollection ? "재수집 요청 중..." : "다시 시도"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetrySearch}
                      disabled={isRetryingCollection}
                    >
                      다시 검색
                    </Button>
                  </div>
                }
              />
            </Box>
          )}

          {keyword && pageState === "timeout" && (
            <Box className="p-6 md:p-8">
              <StatusState
                variant="warning"
                title="아직 수집이 완료되지 않았습니다"
                description={message || POLLING_TIMEOUT_MESSAGE}
              />
            </Box>
          )}

          {summary && (
            <>
              {updatedAt && (
                <StatusState
                  variant="success"
                  compact
                  title="최근 수집 시간"
                  description={updatedAt}
                />
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {cards.map((card) => (
                  <MetricCard
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    desc={card.desc}
                    valueClassName={getFinancialStatusTextClass(card.value)}
                  />
                ))}
              </div>

              <AiSummarySection
                lines={summary.summaryLines}
                sourceReport={summary.sourceReport}
              />

              <AiReportSlot
                title="AI 분석 리포트"
                description="최근 5개년 재무 데이터를 바탕으로 핵심 흐름과 예측 정보를 제공합니다."
                enabled={ENABLE_AI_ANALYSIS}
                status={aiReportState.status}
                analysis={aiReportState.analysis}
                errorText={aiReportState.errorText}
              />

              {!!summary.events?.length && (
                <Box className="p-5">
                  <SectionLabel>주요 재무 이벤트</SectionLabel>
                  <div className="space-y-3">
                    {summary.events.map((event, index) => (
                      <div
                        key={`${event.title}-${index}`}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-sm font-semibold">
                          {event.title}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {event.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </Box>
              )}
            </>
          )}
        </div>

      </div>

      {showFloatingDetailButton && (
        <div className="mt-5 flex justify-center">
          <div>
            <Link
              href={buildCompanyAnalysisUrl("/detail", analysisTarget)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              상세 분석으로 이동
            </Link>
          </div>
        </div>
      )}
      <ScrollTopButton />
    </PageFrame>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryPageContent />
    </Suspense>
  );
}
