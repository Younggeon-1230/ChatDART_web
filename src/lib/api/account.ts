import type {
  DashboardResponseApi,
  MembershipPlanItemApi,
  MembershipPlansResponseApi,
  UserMembershipApi,
  WatchlistCreateRequestApi,
  WatchlistMutationResponseApi,
  WatchlistPostResponseApi,
  WatchlistSummaryItemApi,
  WatchlistSummariesResponseApi,
  WatchlistUpdateRequestApi,
} from "@/types/api";
import { API_V1_BASE_URL } from "@/lib/apiConfig";
import {
  authorizedApiRequest,
  createHttpError,
  request,
} from "@/lib/api/client";

function normalizeMembershipPlansResponse(
  response: MembershipPlanItemApi[] | MembershipPlansResponseApi
): MembershipPlanItemApi[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.plans)) {
    return response.plans;
  }

  return [];
}

export async function getMembershipPlans(): Promise<MembershipPlanItemApi[]> {
  const response = await request<
    MembershipPlanItemApi[] | MembershipPlansResponseApi
  >(
    "/membership/plans",
    {
      authMode: "none",
    },
    API_V1_BASE_URL
  );

  return normalizeMembershipPlansResponse(response);
}

export async function getMyMembership(): Promise<UserMembershipApi> {
  return authorizedApiRequest<UserMembershipApi>("/membership/me");
}

export async function getWatchlistSummaries(): Promise<WatchlistSummariesResponseApi> {
  const response = await authorizedApiRequest<
    WatchlistSummariesResponseApi | WatchlistSummaryItemApi[]
  >("/users/me/watchlist/summaries");

  return normalizeWatchlistSummariesResponse(response);
}

function normalizeWatchlistSummariesResponse(
  response: WatchlistSummariesResponseApi | WatchlistSummaryItemApi[]
): WatchlistSummariesResponseApi {
  if (Array.isArray(response)) {
    return { items: response };
  }

  return {
    ...response,
    items: Array.isArray(response.items) ? response.items : [],
  };
}

function trimMemo(memo?: string | null) {
  const nextMemo = memo?.trim() ?? "";

  if (nextMemo.length > 500) {
    throw createHttpError("메모는 500자 이내로 입력해 주세요.", 422);
  }

  return nextMemo || null;
}

export async function addWatchlistItem(
  stockCode: string,
  companyName: string,
  memo?: string | null
): Promise<WatchlistPostResponseApi> {
  const payload: WatchlistCreateRequestApi = {
    stock_code: stockCode,
    company_name: companyName,
    memo: trimMemo(memo),
  };

  return authorizedApiRequest<WatchlistPostResponseApi>("/users/me/watchlist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateWatchlistItem(
  stockCode: string,
  payload: WatchlistUpdateRequestApi
): Promise<WatchlistMutationResponseApi> {
  return authorizedApiRequest<WatchlistMutationResponseApi>(
    `/users/me/watchlist/${encodeURIComponent(stockCode)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...payload,
        memo: trimMemo(payload.memo),
      }),
    }
  );
}

export async function updateWatchlistMemo(
  stockCode: string,
  memo: string
): Promise<WatchlistMutationResponseApi> {
  return updateWatchlistItem(stockCode, { memo });
}

export async function removeWatchlistItem(stockCode: string): Promise<void> {
  return authorizedApiRequest<void>(
    `/users/me/watchlist/${encodeURIComponent(stockCode)}`,
    {
      method: "DELETE",
      allowEmptyResponse: true,
    }
  );
}

export async function getDashboard(): Promise<DashboardResponseApi> {
  return authorizedApiRequest<DashboardResponseApi>("/users/me/dashboard");
}
