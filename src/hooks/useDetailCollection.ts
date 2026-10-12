"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataSource } from "@/components/layout/DataSourceProvider";
import {
  getApiErrorStatus,
  getSummaryDetail,
  getUserFriendlyApiErrorMessage,
  startCollection,
} from "@/lib/api";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import {
  createDetailCollectionRequestLock,
  runDetailCollectionLifecycle,
  type DetailCollectionLifecycleEvent,
} from "@/lib/detailCollectionFlow";
import type { CompanySummaryApiResponse } from "@/types/api";

export type DetailPageState =
  | "idle"
  | "collecting"
  | "polling"
  | "fetching"
  | "completed"
  | "timeout"
  | "error";

type UseDetailCollectionOptions = {
  keyword: string;
  target: CompanyAnalysisTarget;
};

export function useDetailCollection({
  keyword,
  target,
}: UseDetailCollectionOptions) {
  const [pageState, setPageState] = useState<DetailPageState>("idle");
  const [summaryData, setSummaryData] =
    useState<CompanySummaryApiResponse | null>(null);
  const [message, setMessage] = useState("기업을 검색해 주세요.");
  const [errorText, setErrorText] = useState("");
  const { setBackendStatus, setDataSource, setIsRunningAnalysis } =
    useDataSource();
  const requestKey = useMemo(() => JSON.stringify(target), [target]);
  const collectionSession = useMemo(
    () => ({
      key: requestKey,
      lock: createDetailCollectionRequestLock(),
    }),
    [requestKey]
  );

  useEffect(() => {
    const controller = new AbortController();
    const isActive = () => !controller.signal.aborted;

    const applyEvent = (event: DetailCollectionLifecycleEvent) => {
      if (!isActive()) return;

      switch (event.kind) {
        case "collecting":
          setPageState("collecting");
          setBackendStatus("requesting");
          setMessage(event.message);
          return;
        case "polling":
          setPageState("polling");
          setBackendStatus("requesting");
          setMessage(event.message);
          return;
        case "completed":
          if (event.detail.__dataSource === "mock") {
            setDataSource("mock");
            setBackendStatus("fallback-mock");
          } else {
            setDataSource(event.detail.__dataSource ?? "api");
            setBackendStatus("success");
          }
          setIsRunningAnalysis(false);
          setSummaryData(event.detail.summary);
          setPageState("completed");
          setMessage("상세 분석이 완료되었습니다.");
          return;
        case "failed":
          setPageState("error");
          setErrorText(event.message);
          setDataSource("none");
          setBackendStatus("failed");
          setIsRunningAnalysis(false);
          return;
        case "timeout":
          setPageState("timeout");
          setBackendStatus("timeout");
          setIsRunningAnalysis(false);
          setMessage(event.message);
      }
    };

    async function run() {
      if (!keyword) {
        setPageState("idle");
        setSummaryData(null);
        setErrorText("");
        setMessage("기업을 검색해 주세요.");
        setDataSource("none");
        setBackendStatus("idle");
        setIsRunningAnalysis(false);
        return;
      }

      setPageState("fetching");
      setSummaryData(null);
      setErrorText("");
      setMessage(`"${keyword}" 상세 분석 데이터를 불러오는 중입니다.`);
      setDataSource("none");
      setBackendStatus("requesting");
      setIsRunningAnalysis(true);

      try {
        await runDetailCollectionLifecycle(
          target,
          {
            getSummaryDetail,
            startCollection,
          },
          collectionSession.lock,
          { signal: controller.signal, onEvent: applyEvent }
        );
      } catch (error) {
        if (!isActive()) return;

        const status = getApiErrorStatus(error);
        setPageState("error");
        setDataSource("none");
        setBackendStatus(status === 408 ? "timeout" : "failed");
        setIsRunningAnalysis(false);
        setErrorText(
          getUserFriendlyApiErrorMessage(
            error,
            "상세 분석 요청 처리 중 오류가 발생했습니다."
          )
        );
      }
    }

    void run();

    return () => controller.abort();
  }, [
    collectionSession,
    keyword,
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
    target,
  ]);

  return { pageState, summaryData, message, errorText };
}
