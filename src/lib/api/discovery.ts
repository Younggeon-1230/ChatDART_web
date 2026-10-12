import type {
  PopularCompaniesResponseApi,
  PopularCompaniesWindow,
  RecommendedCompanyApi,
  SimilarCompaniesResponseApi,
  SimilarCompanyApi,
} from "@/types/api";
import { mockSearchResultsApi } from "@/mock/api";
import { USE_MOCK_API } from "@/lib/apiConfig";
import { request } from "@/lib/api/client";

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function trimKeyword(keyword: string): string {
  return keyword.trim();
}

export async function getSimilarCompanies(
  keyword: string,
  limit?: number
): Promise<SimilarCompanyApi[]> {
  const response = await request<SimilarCompaniesResponseApi>(
    `/similar${buildQuery({ keyword: trimKeyword(keyword), limit })}`,
    {
      authMode: "required",
    }
  );

  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.similar_companies)) return response.similar_companies;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export async function getRecommendedCompanies(
  limit = 5
): Promise<RecommendedCompanyApi[]> {
  return request<RecommendedCompanyApi[]>(
    `/recommendation${buildQuery({ limit })}`,
    { authMode: "required" }
  );
}

/**
 * 諛쒗몴???뺤옣 ?ъ씤??
 * ?꾩옱 ?곗꽑?쒖쐞?????留? 異뷀썑 ?멸린 寃??湲곗뾽 湲곕뒫??遺숈씪 ???ъ슜?????덉뒿?덈떎.
 */
export async function getPopularCompanies(params?: {
  limit?: number;
  window?: PopularCompaniesWindow;
}): Promise<PopularCompaniesResponseApi> {
  if (USE_MOCK_API) {
    const limit = params?.limit ?? 10;
    const window = params?.window ?? "realtime";

    return {
      items: mockSearchResultsApi.slice(0, limit).map((company, index) => ({
        keyword: company.name ?? company.code ?? `Mock ${index + 1}`,
        count: 100 - index * 10,
        rank: index + 1,
        updated_at: new Date().toISOString(),
      })),
      window,
      generated_at: new Date().toISOString(),
    };
  }

  const query = buildQuery({
    limit: params?.limit ?? 10,
    window: params?.window ?? "realtime",
  });

  return request<PopularCompaniesResponseApi>(`/search/popular${query}`, {
    authMode: "required",
  });
}
