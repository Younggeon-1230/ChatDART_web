import type {
  CompareShareResponseApi,
  CompareShareSaveResponseApi,
} from "@/types/api";
import { request } from "@/lib/api/client";

type QueryValue = string | number | boolean | null | undefined;

function buildRepeatedQuery(
  repeatedKey: string,
  values: Array<string | null | undefined>,
  params?: Record<string, QueryValue>
): string {
  const searchParams = new URLSearchParams();

  values
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)
    .forEach((value) => {
      searchParams.append(repeatedKey, value);
    });

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function saveCompareShare(
  keywords: string[],
  unit = "원"
): Promise<CompareShareSaveResponseApi> {
  return request<CompareShareSaveResponseApi>(
    `/compare/save${buildRepeatedQuery("keywords", keywords, { unit })}`,
    {
      method: "POST",
      authMode: "required",
    }
  );
}

export async function createCompareShareLink(
  keywords: string[],
  unit = "원"
): Promise<CompareShareSaveResponseApi> {
  return saveCompareShare(keywords, unit);
}

export async function getCompareShare(
  shareId: string
): Promise<CompareShareResponseApi> {
  return request<CompareShareResponseApi>(
    `/compare/${encodeURIComponent(shareId)}`,
    {
      authMode: "none",
    }
  );
}
