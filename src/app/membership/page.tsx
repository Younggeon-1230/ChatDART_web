"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, ShieldCheck } from "lucide-react";
import Button from "@/components/common/Button";
import { CardHeaderBlock, PricingCard, SectionCard } from "@/components/common/Card";
import { StatusState } from "@/components/common/StatusState";
import PageFrame from "@/components/financial/PageFrame";
import {
  getMembershipPlans,
  getMyMembership,
  getUserFriendlyApiErrorMessage,
} from "@/lib/api";
import { getApiErrorStatus } from "@/lib/apiErrors";
import { getStoredAuthTokens } from "@/lib/authTokens";
import type { MembershipPlanItemApi, UserMembershipApi } from "@/types/api";

type SectionState = "idle" | "loading" | "success" | "error" | "login_required";

type PolicyPlan = {
  name: string;
  tier: "free" | "pro";
  priceText: string;
  watchlistLimit: number;
  durationText: string;
  description: string;
  features: string[];
};

const POLICY_PLANS: PolicyPlan[] = [
  {
    name: "Free",
    tier: "free",
    priceText: "무료",
    watchlistLimit: 5,
    durationText: "기본 요금제",
    description: "시작 단계에서 필요한 기본 재무 분석을 제공합니다.",
    features: [
      "관심 기업 최대 5개 저장",
      "3줄 요약 / 상세 분석 확인",
      "기업 비교 기능 사용",
      "AI 요약·예측 확인",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    priceText: "9,900원",
    watchlistLimit: 50,
    durationText: "30일",
    description: "더 많은 관심 기업을 관리할 수 있는 확장 요금제입니다.",
    features: [
      "관심 기업 최대 50개 저장",
      "저장한 관심 기업별 메모 관리",
      "마이페이지에서 관심 기업 요약 확인",
      "관심 기업 관리 한도를 넉넉하게 확장",
    ],
  },
];

function formatPlanName(plan: MembershipPlanItemApi | PolicyPlan): string {
  return String(plan.name || plan.tier || "요금제").toUpperCase();
}

function formatPrice(plan: MembershipPlanItemApi | PolicyPlan): string {
  if ("priceText" in plan && typeof plan.priceText === "string") {
    return plan.priceText;
  }

  const value =
    "price_krw" in plan || "price" in plan
      ? plan.price_krw ?? plan.price
      : null;
  if (typeof value === "number") {
    return `${value.toLocaleString("ko-KR")}원`;
  }

  return value ? String(value) : "요금 정보를 확인할 수 없습니다";
}

function formatDuration(plan: MembershipPlanItemApi | PolicyPlan): string {
  if ("durationText" in plan && typeof plan.durationText === "string") {
    return plan.durationText;
  }
  return "duration_days" in plan && plan.duration_days
    ? `${plan.duration_days}일`
    : "이용 기간을 확인할 수 없습니다";
}

function formatWatchlistLimit(value?: number | null) {
  return Number.isFinite(value) ? `관심 기업 최대 ${Number(value)}개` : "한도 정보를 확인할 수 없습니다";
}

function getPlanTier(plan: MembershipPlanItemApi | PolicyPlan) {
  return "tier" in plan ? plan.tier : plan.plan;
}

function getPolicyPlan(plan: MembershipPlanItemApi | PolicyPlan) {
  return POLICY_PLANS.find((item) => item.tier === getPlanTier(plan));
}

function getPlanWatchlistLimit(plan: MembershipPlanItemApi | PolicyPlan) {
  if ("watchlistLimit" in plan && typeof plan.watchlistLimit === "number") {
    return plan.watchlistLimit;
  }

  if ("watchlist_limit" in plan && Number.isFinite(plan.watchlist_limit)) {
    return Number(plan.watchlist_limit);
  }

  return getPolicyPlan(plan)?.watchlistLimit ?? null;
}

function formatMembershipTier(membership: UserMembershipApi | null) {
  return String(
    membership?.membership_tier ||
      membership?.tier ||
      membership?.plan ||
      "정보를 확인할 수 없습니다"
  ).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "제한 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "정보를 확인할 수 없습니다";

  return date.toLocaleDateString("ko-KR");
}

function formatMembershipWatchlistUsage(membership: UserMembershipApi) {
  return `${membership.watchlist_count} / ${membership.watchlist_limit}개`;
}

function getMembershipErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 401 || status === 403) {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (status === 408 || error instanceof TypeError) {
    return "연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.";
  }

  return getUserFriendlyApiErrorMessage(
    error,
    "멤버십 정보를 불러오지 못했습니다."
  );
}

export default function MembershipPage() {
  const router = useRouter();
  const [plansState, setPlansState] = useState<SectionState>("idle");
  const [membershipState, setMembershipState] =
    useState<SectionState>("idle");
  const [plans, setPlans] = useState<MembershipPlanItemApi[]>([]);
  const [membership, setMembership] = useState<UserMembershipApi | null>(null);
  const [plansErrorText, setPlansErrorText] = useState("");
  const [membershipErrorText, setMembershipErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      try {
        setPlansState("loading");
        setPlansErrorText("");
        const response = await getMembershipPlans();

        if (!isMounted) return;

        setPlans(response);
        setPlansState("success");
      } catch (error) {
        if (!isMounted) return;

        setPlans([]);
        setPlansErrorText(getMembershipErrorMessage(error));
        setPlansState("error");
      }
    }

    async function loadMyMembership() {
      if (!getStoredAuthTokens()) {
        setMembershipState("login_required");
        return;
      }

      try {
        setMembershipState("loading");
        setMembershipErrorText("");
        const response = await getMyMembership();

        if (!isMounted) return;

        setMembership(response);
        setMembershipState("success");
      } catch (error) {
        if (!isMounted) return;

        setMembership(null);
        setMembershipErrorText(getMembershipErrorMessage(error));
        setMembershipState("error");
      }
    }

    void loadPlans();
    void loadMyMembership();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayPlans = useMemo(
    () => [
      ...POLICY_PLANS,
      ...plans.filter((plan) => !getPolicyPlan(plan)),
    ],
    [plans]
  );

  return (
    <PageFrame
      title="멤버십"
      description="ChatDart 요금제 정책과 현재 계정의 이용 상태를 확인합니다."
      icon={Crown}
    >
      <div className="space-y-5">
        <SectionCard className="p-5 sm:p-6">
          <CardHeaderBlock
            title="서비스 정책"
            description="요금제별 이용 범위와 관심 기업 한도를 확인하세요."
          />

          {plansState === "loading" && (
            <StatusState
              variant="loading"
              compact
              className="mt-5"
              title="요금제 정보를 불러오는 중입니다"
            />
          )}

          {plansState === "error" && (
            <StatusState
              variant="warning"
              compact
              className="mt-5"
              title="요금제 정보를 불러오지 못했습니다"
              description={plansErrorText}
            />
          )}

          {plansState === "success" && plans.length === 0 && (
            <StatusState
              variant="empty"
              compact
              className="mt-5"
              title="기본 요금제 정보를 안내합니다"
              description="아래 요금제 정책을 기준으로 확인해 주세요."
            />
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {displayPlans.map((plan) => {
              const apiFeatures =
                "features" in plan && Array.isArray(plan.features)
                  ? plan.features
                  : [];
              const features = getPolicyPlan(plan)?.features ?? apiFeatures;
              const watchlistLimit = getPlanWatchlistLimit(plan);
              const isFreePlan = getPlanTier(plan) === "free";

              return (
                <PricingCard key={`${plan.tier ?? plan.name ?? "plan"}`}>
                  <div className="flex flex-1 flex-col">
                    <div>
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-lg font-semibold text-slate-950">
                            {formatPlanName(plan)}
                          </h2>
                          <p className="mt-2 break-words text-2xl font-semibold text-blue-950">
                            {formatPrice(plan)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDuration(plan)}
                          </p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap rounded-lg bg-sky-100 px-3 py-1 text-xs font-semibold text-blue-800">
                          {formatWatchlistLimit(watchlistLimit)}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        {"description" in plan && plan.description
                          ? plan.description
                          : "멤버십 정책을 확인해 주세요."}
                      </p>
                    </div>

                    <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                      {(features.length > 0
                        ? features
                        : [formatWatchlistLimit(watchlistLimit)]
                      ).map((feature) => (
                        <li
                          key={feature}
                          className="break-words rounded-lg bg-slate-50 px-3 py-2"
                        >
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled
                      variant="outline"
                      className="mt-5 w-full"
                    >
                      {isFreePlan ? "기본 요금제" : "업그레이드 준비 중"}
                    </Button>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {isFreePlan
                        ? "기본 분석 기능을 무료로 이용할 수 있습니다."
                        : "Pro 멤버십 신청은 곧 제공될 예정입니다."}
                    </p>
                  </div>
                </PricingCard>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <CardHeaderBlock
            eyebrow={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />내 계정</span>}
            title="현재 멤버십"
            description="로그인 계정 기준 멤버십 상태와 관심 기업 사용량입니다."
          />

          <div className="mt-5">
            {membershipState === "login_required" && (
              <StatusState
                variant="info"
                title="로그인이 필요합니다"
                description="로그인하면 현재 멤버십 상태를 확인할 수 있습니다."
                action={
                  <Button
                    onClick={() => router.push("/login?redirect=/membership")}
                  >
                    로그인하기
                  </Button>
                }
              />
            )}

            {membershipState === "loading" && (
              <StatusState
                variant="loading"
                title="현재 멤버십 정보를 불러오는 중입니다"
              />
            )}

            {membershipState === "error" && (
              <StatusState
                variant="error"
                title="현재 멤버십 정보를 불러오지 못했습니다"
                description={membershipErrorText}
                action={
                  <Button
                    variant="outline"
                    onClick={() => router.push("/login?redirect=/membership")}
                  >
                    로그인하기
                  </Button>
                }
              />
            )}

            {membershipState === "success" && membership && (
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                  <dt className="font-medium text-slate-500">현재 요금제</dt>
                  <dd className="mt-2 text-xl font-semibold text-blue-950">
                    {formatMembershipTier(membership)}
                  </dd>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                  <dt className="font-medium text-slate-500">상태</dt>
                  <dd className="mt-2 text-xl font-semibold text-blue-950">
                    {membership.status || "정보를 확인할 수 없습니다"}
                  </dd>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                  <dt className="font-medium text-slate-500">만료일</dt>
                  <dd className="mt-2 text-xl font-semibold text-blue-950">
                    {formatDate(membership.expires_at)}
                  </dd>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                  <dt className="font-medium text-slate-500">관심 기업</dt>
                  <dd className="mt-2 text-xl font-semibold text-blue-950">
                    {formatMembershipWatchlistUsage(membership)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
