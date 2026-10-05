"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Crown,
  Heart,
  History,
  LogOut,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Button from "@/components/common/Button";
import { CardHeaderBlock, SectionCard } from "@/components/common/Card";
import { StatusState } from "@/components/common/StatusState";
import PageFrame from "@/components/financial/PageFrame";
import {
  addWatchlistItem,
  getDashboard,
  getUserFriendlyApiErrorMessage,
  getWatchlistSummaries,
  removeWatchlistItem,
  updateWatchlistMemo,
} from "@/lib/api";
import { getApiErrorStatus } from "@/lib/apiErrors";
import { buildCompanyAnalysisUrl } from "@/lib/companySearch";
import {
  getDashboardRecentSearchStockCode,
  selectDashboardRecentSearches,
} from "@/lib/dashboardRecentSearches";
import { getStoredAuthTokens } from "@/lib/authTokens";
import type {
  DashboardRecentSearchItemApi,
  DashboardResponseApi,
  PopularCompanyItemApi,
  WatchlistSummaryItemApi,
} from "@/types/api";

type DashboardState = "checking" | "login_required" | "loading" | "success" | "error";
type SectionState = "idle" | "loading" | "success" | "error";

function formatMembership(value: DashboardResponseApi["membership_tier"]) {
  if (!value) return "정보를 확인할 수 없습니다";
  return String(value).toUpperCase();
}

function formatUsage(count?: number, limit?: number) {
  const safeCount = Number.isFinite(count) ? Number(count) : 0;

  if (!Number.isFinite(limit)) {
    return `${safeCount}개`;
  }

  return `${safeCount} / ${Number(limit)}개`;
}

function getWatchlistLabel(item: WatchlistSummaryItemApi) {
  return (
    item.company_name ||
    item.summary?.company_name ||
    item.latest_summary?.company_name ||
    item.stock_code ||
    "기업 정보를 확인할 수 없습니다"
  );
}

function getRecentLabel(item: DashboardRecentSearchItemApi) {
  return (
    item.company_name ||
    item.companyName ||
    item.name ||
    item.keyword ||
    item.stock_code ||
    item.stockCode ||
    "검색 정보를 확인할 수 없습니다"
  );
}

function getPopularLabel(item: PopularCompanyItemApi) {
  return item.company_name || item.keyword || item.stock_code || "기업 정보를 확인할 수 없습니다";
}

function getCompanyHref(label: string, stockCode?: string | null) {
  return buildCompanyAnalysisUrl("/summary", {
    keyword: stockCode || label,
    stockCode: stockCode || undefined,
    displayName: label,
  });
}

function getDashboardErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 401 || status === 403) {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (status === 408 || error instanceof TypeError) {
    return "연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.";
  }

  return getUserFriendlyApiErrorMessage(
    error,
    "마이페이지 데이터를 불러오지 못했습니다."
  );
}

function getWatchlistActionErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 403) {
    return "즐겨찾기 한도를 초과했습니다. 멤버십 한도를 확인해 주세요.";
  }

  if (status === 409) {
    return "이미 즐겨찾기에 추가된 기업입니다.";
  }

  return getDashboardErrorMessage(error);
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <SectionCard className="p-4 sm:p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-blue-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </SectionCard>
  );
}

function EmptyList({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-sky-100 bg-sky-50/60 px-4 py-5 text-sm leading-6 text-slate-500">
      {children}
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>("checking");
  const [dashboard, setDashboard] = useState<DashboardResponseApi | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<
    WatchlistSummaryItemApi[]
  >([]);
  const [watchlistState, setWatchlistState] = useState<SectionState>("idle");
  const [watchlistErrorText, setWatchlistErrorText] = useState("");
  const [editingStockCode, setEditingStockCode] = useState("");
  const [memoDraft, setMemoDraft] = useState("");
  const [savingMemoStockCode, setSavingMemoStockCode] = useState("");
  const [memoErrorText, setMemoErrorText] = useState("");
  const [newWatchlistCompanyName, setNewWatchlistCompanyName] = useState("");
  const [newWatchlistStockCode, setNewWatchlistStockCode] = useState("");
  const [addingWatchlist, setAddingWatchlist] = useState(false);
  const [deletingStockCode, setDeletingStockCode] = useState("");
  const [watchlistActionErrorText, setWatchlistActionErrorText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!getStoredAuthTokens()) {
        setState("login_required");
        return;
      }

      try {
        setState("loading");
        setWatchlistState("loading");
        setErrorText("");
        setWatchlistErrorText("");

        const [dashboardResult, watchlistResult] = await Promise.allSettled([
          getDashboard(),
          getWatchlistSummaries(),
        ]);

        if (!isMounted) return;

        if (watchlistResult.status === "fulfilled") {
          setWatchlistItems(watchlistResult.value.items);
          setWatchlistState("success");
        } else {
          setWatchlistItems([]);
          setWatchlistErrorText(
            getDashboardErrorMessage(watchlistResult.reason)
          );
          setWatchlistState("error");
        }

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
          setState("success");
          return;
        }

        setDashboard(null);
        setErrorText(getDashboardErrorMessage(dashboardResult.reason));
        setState("error");
      } catch (error) {
        if (!isMounted) return;

        setDashboard(null);
        setWatchlistState("error");
        setWatchlistErrorText(getDashboardErrorMessage(error));
        setErrorText(getDashboardErrorMessage(error));
        setState("error");
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const watchlistPreview = useMemo(
    () =>
      watchlistState === "success" ? watchlistItems : dashboard?.watchlist_preview ?? [],
    [dashboard, watchlistItems, watchlistState]
  );
  const popularWeek = useMemo(() => dashboard?.popular_week ?? [], [dashboard]);
  const recentSearches = useMemo(
    () => selectDashboardRecentSearches(dashboard?.recent_searches ?? []),
    [dashboard]
  );
  const watchlistCount =
    dashboard?.watchlist_count ?? dashboard?.usage?.watchlist_count;
  const watchlistLimit =
    dashboard?.watchlist_limit ?? dashboard?.usage?.watchlist_limit;

  function startMemoEdit(item: WatchlistSummaryItemApi) {
    const stockCode = item.stock_code;
    if (!stockCode) return;

    setEditingStockCode(stockCode);
    setMemoDraft(item.memo ?? "");
    setMemoErrorText("");
  }

  function cancelMemoEdit() {
    setEditingStockCode("");
    setMemoDraft("");
    setMemoErrorText("");
  }

  async function saveMemo(stockCode: string) {
    if (memoDraft.length > 500) {
      setMemoErrorText("메모는 500자 이내로 입력해 주세요.");
      return;
    }

    try {
      setSavingMemoStockCode(stockCode);
      setMemoErrorText("");
      await updateWatchlistMemo(stockCode, memoDraft);
      setWatchlistItems((prev) =>
        prev.map((item) =>
          item.stock_code === stockCode ? { ...item, memo: memoDraft.trim() || null } : item
        )
      );
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              watchlist_preview: prev.watchlist_preview?.map((item) =>
                item.stock_code === stockCode
                  ? { ...item, memo: memoDraft.trim() || null }
                  : item
              ),
            }
          : prev
      );
      cancelMemoEdit();
    } catch (error) {
      setMemoErrorText(
        getDashboardErrorMessage(error) ||
          "메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingMemoStockCode("");
    }
  }

  async function reloadDashboardAndWatchlist() {
    const [nextDashboard, nextWatchlist] = await Promise.all([
      getDashboard(),
      getWatchlistSummaries(),
    ]);

    setDashboard(nextDashboard);
    setWatchlistItems(nextWatchlist.items);
    setWatchlistState("success");
    setWatchlistErrorText("");
  }

  async function addWatchlist() {
    const companyName = newWatchlistCompanyName.trim();
    const stockCode = newWatchlistStockCode.trim();
    if (!companyName || !stockCode) return;

    try {
      setAddingWatchlist(true);
      setWatchlistActionErrorText("");
      await addWatchlistItem(stockCode, companyName);
      await reloadDashboardAndWatchlist();
      setNewWatchlistCompanyName("");
      setNewWatchlistStockCode("");
    } catch (error) {
      setWatchlistActionErrorText(getWatchlistActionErrorMessage(error));
    } finally {
      setAddingWatchlist(false);
    }
  }

  async function deleteWatchlist(stockCode: string) {
    try {
      setDeletingStockCode(stockCode);
      setWatchlistActionErrorText("");
      await removeWatchlistItem(stockCode);
      await reloadDashboardAndWatchlist();
    } catch (error) {
      setWatchlistActionErrorText(getWatchlistActionErrorMessage(error));
    } finally {
      setDeletingStockCode("");
    }
  }

  return (
    <PageFrame
      title="마이페이지"
      description="로그인 사용자 기준의 멤버십, 즐겨찾기, 검색 흐름을 확인합니다."
      icon={UserRound}
    >
      {state === "checking" || state === "loading" ? (
        <StatusState
          variant="loading"
          title="마이페이지 데이터를 불러오는 중입니다"
          description="저장된 로그인 정보로 대시보드를 확인하고 있습니다."
        />
      ) : null}

      {state === "login_required" ? (
        <StatusState
          variant="info"
          title="로그인이 필요합니다"
          description="마이페이지는 로그인 후 확인할 수 있습니다."
          action={
            <Button onClick={() => router.push("/login?redirect=/mypage")}>
              로그인하기
            </Button>
          }
        />
      ) : null}

      {state === "error" ? (
        <StatusState
          variant="error"
          title="마이페이지 데이터를 불러오지 못했습니다"
          description={errorText}
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>다시 시도</Button>
              <Button
                variant="outline"
                onClick={() => router.push("/login?redirect=/mypage")}
              >
                로그인하기
              </Button>
            </div>
          }
        />
      ) : null}

      {state === "success" && dashboard ? (
        <div className="space-y-5">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/membership")}
            >
              <Crown className="h-4 w-4" />
              멤버십 관리
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/logout?redirect=/mypage")}
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="멤버십"
              value={formatMembership(dashboard.membership_tier)}
              description="현재 계정에 적용된 이용 등급입니다."
            />
            <StatCard
              title="즐겨찾기 사용량"
              value={formatUsage(watchlistCount, watchlistLimit)}
              description="관심 기업으로 저장한 기업 수입니다."
            />
            <StatCard
              title="최근 검색"
              value={`${recentSearches.length}개`}
              description="최근 확인한 기업과 검색어를 모아 보여드립니다."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard className="p-5 sm:p-6">
              <CardHeaderBlock
                eyebrow={<span className="inline-flex items-center gap-2"><Heart className="h-4 w-4" />즐겨찾기</span>}
                title="관심 기업 미리보기"
                description="저장한 기업의 최근 수집 상태를 확인합니다."
              />
              <div className="mt-5 space-y-3">
                <form
                  className="flex flex-col gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addWatchlist();
                  }}
                >
                  <input
                    value={newWatchlistCompanyName}
                    onChange={(event) =>
                      setNewWatchlistCompanyName(event.target.value)
                    }
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                    placeholder="기업명 입력"
                    aria-label="추가할 기업명"
                  />
                  <input
                    value={newWatchlistStockCode}
                    onChange={(event) =>
                      setNewWatchlistStockCode(event.target.value)
                    }
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                    placeholder="추가할 종목코드 입력"
                    aria-label="추가할 종목코드"
                  />
                  <Button
                    type="submit"
                    disabled={
                      !newWatchlistCompanyName.trim() ||
                      !newWatchlistStockCode.trim() ||
                      addingWatchlist
                    }
                  >
                    <Plus className="h-4 w-4" />
                    {addingWatchlist ? "추가 중" : "추가"}
                  </Button>
                </form>

                {watchlistActionErrorText && (
                  <StatusState
                    variant="error"
                    compact
                    title="즐겨찾기를 변경하지 못했습니다"
                    description={watchlistActionErrorText}
                  />
                )}

                {watchlistState === "loading" ? (
                  <StatusState
                    variant="loading"
                    compact
                    title="관심 기업 정보를 불러오는 중입니다"
                  />
                ) : null}

                {watchlistState === "error" ? (
                  <StatusState
                    variant="error"
                    compact
                    title="관심 기업 정보를 불러오지 못했습니다"
                    description={
                      watchlistErrorText ||
                      "잠시 후 다시 시도해 주세요."
                    }
                  />
                ) : null}

                {memoErrorText && (
                  <StatusState
                    variant="error"
                    compact
                    title="메모를 저장하지 못했습니다"
                    description={memoErrorText}
                  />
                )}

                {watchlistState !== "loading" && watchlistPreview.length === 0 ? (
                  <EmptyList>아직 즐겨찾기한 기업이 없습니다.</EmptyList>
                ) : (
                  watchlistPreview.slice(0, 6).map((item, index) => {
                    const label = getWatchlistLabel(item);
                    const stockCode =
                      item.stock_code ||
                      item.summary?.stock_code ||
                      item.latest_summary?.stock_code ||
                      null;

                    return (
                      <div
                        key={`${stockCode ?? label}-${index}`}
                        className="rounded-xl border border-sky-100 bg-white p-4 text-sm shadow-[0_4px_14px_rgba(15,23,42,0.035)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="break-words text-base font-semibold leading-6 text-slate-950">
                                {label}
                              </span>
                              {stockCode && (
                                <span className="text-xs font-normal text-slate-400">
                                  {stockCode}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              size="icon"
                              variant="danger"
                              aria-label={`${label} 즐겨찾기 삭제`}
                              onClick={() => stockCode && void deleteWatchlist(stockCode)}
                              disabled={
                                !stockCode || deletingStockCode === stockCode
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <Link
                          href={getCompanyHref(label, stockCode)}
                          aria-label={`${label} 최근 정보 보기`}
                          className="mt-3 inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition hover:border-blue-300 hover:bg-sky-50 hover:text-blue-950 focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 active:bg-sky-100"
                        >
                          최근 정보 보기
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>

                        {editingStockCode === stockCode ? (
                          <div className="mt-4 space-y-2 border-t border-sky-100 pt-4">
                            <textarea
                              value={memoDraft}
                              maxLength={500}
                              onChange={(event) =>
                                setMemoDraft(event.target.value)
                              }
                              className="min-h-20 w-full resize-y rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm outline-none transition focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100"
                              placeholder="메모를 입력해 주세요."
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-slate-500">
                                {memoDraft.length} / 500
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelMemoEdit}
                                  disabled={savingMemoStockCode === stockCode}
                                >
                                  취소
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => stockCode && saveMemo(stockCode)}
                                  disabled={
                                    !stockCode ||
                                    memoDraft.length > 500 ||
                                    savingMemoStockCode === stockCode
                                  }
                                >
                                  {savingMemoStockCode === stockCode
                                    ? "저장 중"
                                    : "저장"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="min-w-0 whitespace-pre-line break-words text-xs leading-5 text-slate-500">
                              {item.memo || "메모를 추가해 보세요."}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => startMemoEdit(item)}
                              disabled={!stockCode}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              {item.memo ? "메모 수정" : "메모 추가"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard className="p-5 sm:p-6">
              <CardHeaderBlock
                eyebrow={<span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" />인기</span>}
                title="주간 인기 기업"
                description="이번 주 조회가 많았던 기업입니다."
              />
              <div className="mt-5 space-y-3">
                {popularWeek.length === 0 ? (
                  <EmptyList>주간 인기 데이터가 아직 없습니다.</EmptyList>
                ) : (
                  popularWeek.slice(0, 8).map((item, index) => {
                    const label = getPopularLabel(item);
                    const stockCode = item.stock_code ?? null;

                    return (
                      <Link
                        key={`${stockCode ?? label}-${index}`}
                        href={getCompanyHref(label, stockCode)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-sky-100 bg-white px-4 py-3 text-sm transition hover:border-blue-200 hover:bg-sky-50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-xs font-semibold text-blue-800">
                            {item.rank ?? index + 1}
                          </span>
                          <span className="truncate font-medium text-slate-900">
                            {label}
                          </span>
                        </span>
                        {typeof item.count === "number" && (
                          <span className="shrink-0 text-xs text-slate-500">
                            {item.count.toLocaleString("ko-KR")}회
                          </span>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard className="p-5 sm:p-6">
            <CardHeaderBlock
              eyebrow={<span className="inline-flex items-center gap-2"><History className="h-4 w-4" />최근 활동</span>}
              title="최근 검색"
              description="최근 검색한 기업 또는 검색어입니다."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentSearches.length === 0 ? (
                <EmptyList>최근 검색 기록이 없습니다.</EmptyList>
              ) : (
                recentSearches.map((item, index) => {
                  const label = getRecentLabel(item);
                  const stockCode = getDashboardRecentSearchStockCode(item);

                  return (
                    <Link
                      key={`${stockCode ?? label}-${index}`}
                      href={getCompanyHref(label, stockCode)}
                      className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm outline-none transition hover:border-blue-300 hover:bg-sky-50 hover:shadow-[0_5px_16px_rgba(15,23,42,0.05)] focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 active:bg-sky-100"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition group-hover:bg-white">
                        <Search className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-semibold leading-5 text-slate-950">
                          {label}
                        </span>
                        <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                          {stockCode || item.searched_at || item.viewed_at || "검색 기록"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-sky-500 transition group-hover:translate-x-0.5 group-hover:text-blue-800" aria-hidden="true" />
                    </Link>
                  );
                })
              )}
            </div>
          </SectionCard>

          {dashboard.usage ? (
            <SectionCard className="p-5 sm:p-6">
              <CardHeaderBlock
                eyebrow={<span className="inline-flex items-center gap-2"><Crown className="h-4 w-4" />사용량</span>}
                title="계정 사용량"
                description="현재 계정의 이용 현황을 확인합니다."
              />
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-slate-500">최근 검색 수</dt>
                  <dd className="mt-2 text-lg font-semibold text-blue-950">
                    {dashboard.usage.recent_search_count ?? 0}개
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">즐겨찾기 한도</dt>
                  <dd className="mt-2 text-lg font-semibold text-blue-950">
                    {formatUsage(
                      dashboard.usage.watchlist_count,
                      dashboard.usage.watchlist_limit
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">멤버십 상태</dt>
                  <dd className="mt-2 text-lg font-semibold text-blue-950">
                    {formatMembership(
                      typeof dashboard.usage.membership === "string"
                        ? dashboard.usage.membership
                        : dashboard.usage.membership?.membership_tier ||
                            dashboard.usage.membership?.plan
                    )}
                  </dd>
                </div>
              </dl>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </PageFrame>
  );
}
