import assert from "node:assert/strict";
import test from "node:test";
import { selectRelatedDisclosures } from "@/lib/financialDisclosures";
import type {
  FinancialDisclosureApi,
  FinancialDisclosureCategory,
} from "@/types/api";

function disclosure(
  title: string,
  date: string,
  category: FinancialDisclosureCategory,
  viewerUrl = `https://dart.example/${encodeURIComponent(title)}`
): FinancialDisclosureApi {
  return {
    title,
    date,
    category,
    viewer_url: viewerUrl,
    submitter: "테스트 회사",
  };
}

test("사업보고서를 최신 비정기 공시보다 우선한다", () => {
  const result = selectRelatedDisclosures([
    disclosure("자기주식 처분 결정", "2026-09-20", "major"),
    disclosure("사업보고서 (2025.12)", "2026-03-20", "periodic"),
  ]);

  assert.equal(result[0]?.title, "사업보고서 (2025.12)");
});

test("반기보고서와 분기보고서를 기타 공시보다 우선한다", () => {
  const result = selectRelatedDisclosures([
    disclosure("임원ㆍ주요주주 특정증권등 소유상황보고서", "2026-09-20", "other"),
    disclosure("분기보고서 (2026.03)", "2026-05-15", "periodic"),
    disclosure("반기보고서 (2026.06)", "2026-08-14", "periodic"),
  ]);

  assert.deepEqual(
    result.map((item) => item.title),
    ["반기보고서 (2026.06)", "분기보고서 (2026.03)", "임원ㆍ주요주주 특정증권등 소유상황보고서"]
  );
});

test("잠정실적 category를 이벤트성 공시보다 우선한다", () => {
  const result = selectRelatedDisclosures([
    disclosure("자기주식 취득 결정", "2026-09-20", "major"),
    disclosure("영업(잠정)실적", "2026-07-25", "performance"),
  ]);

  assert.equal(result[0]?.title, "영업(잠정)실적");
});

test("최대 3건만 노출한다", () => {
  const result = selectRelatedDisclosures([
    disclosure("사업보고서", "2026-03-20", "periodic"),
    disclosure("반기보고서", "2026-08-14", "periodic"),
    disclosure("분기보고서", "2026-05-15", "periodic"),
    disclosure("영업실적 발표", "2026-07-25", "performance"),
  ]);

  assert.equal(result.length, 3);
});

test("동일 유형에서는 최신 날짜를 우선한다", () => {
  const result = selectRelatedDisclosures([
    disclosure("분기보고서 (2025.09)", "2025-11-14", "periodic"),
    disclosure("분기보고서 (2026.03)", "2026-05-15", "periodic"),
  ]);

  assert.equal(result[0]?.title, "분기보고서 (2026.03)");
});

test("1~2건이면 제거하지 않고 그대로 노출한다", () => {
  const items = [
    disclosure("자기주식 취득 결정", "2026-09-20", "major"),
    disclosure("기타 경영사항", "2026-09-19", "other"),
  ];

  assert.equal(selectRelatedDisclosures(items).length, 2);
});

test("공시가 없으면 빈 목록을 유지한다", () => {
  assert.deepEqual(selectRelatedDisclosures([]), []);
});

test("완전히 같은 공시는 한 번만 노출한다", () => {
  const item = disclosure(
    "사업보고서",
    "2026-03-20",
    "periodic",
    "https://dart.example/report/1"
  );

  assert.deepEqual(selectRelatedDisclosures([item, { ...item }]), [item]);
});
