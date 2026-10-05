import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLoginHref,
  resolveInternalLoginRedirect,
} from "@/lib/authRedirect";

function getLoginRedirect(href: string) {
  const url = new URL(href, "http://chatdart.local");
  return url.searchParams.get("redirect");
}

test("일반 페이지의 loginHref에 현재 경로를 보존한다", () => {
  assert.equal(buildLoginHref("/membership"), "/login?redirect=%2Fmembership");
  assert.equal(getLoginRedirect(buildLoginHref("/membership")), "/membership");
});

test("query가 없는 페이지는 물음표 없이 redirect를 생성한다", () => {
  assert.equal(getLoginRedirect(buildLoginHref("/summary")), "/summary");
});

test("Summary와 Detail query를 누락 없이 보존한다", () => {
  const search =
    "keyword=005930&stockCode=005930&displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90";

  assert.equal(
    getLoginRedirect(buildLoginHref("/summary", search)),
    "/summary?displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&keyword=005930&stockCode=005930"
  );
  assert.equal(
    getLoginRedirect(buildLoginHref("/detail", search)),
    "/detail?displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&keyword=005930&stockCode=005930"
  );
});

test("Compare의 복수 company와 displayName을 순서와 중복 그대로 보존한다", () => {
  const search = [
    "company=005930",
    "displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90",
    "company=000660",
    "displayName=SK%ED%95%98%EC%9D%B4%EB%8B%89%EC%8A%A4",
    "company=005380",
    "displayName=%ED%98%84%EB%8C%80%EC%B0%A8",
  ].join("&");
  const redirect = getLoginRedirect(buildLoginHref("/compare", search));

  assert.ok(redirect);
  const url = new URL(redirect, "http://chatdart.local");
  assert.deepEqual(url.searchParams.getAll("company"), [
    "005930",
    "000660",
    "005380",
  ]);
  assert.deepEqual(url.searchParams.getAll("displayName"), [
    "삼성전자",
    "SK하이닉스",
    "현대차",
  ]);
});

test("교차형과 key별 그룹형 query가 항상 동일한 loginHref를 만든다", () => {
  const interleaved =
    "company=005930&displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&company=000660&displayName=SK%ED%95%98%EC%9D%B4%EB%8B%89%EC%8A%A4";
  const grouped =
    "company=005930&company=000660&displayName=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&displayName=SK%ED%95%98%EC%9D%B4%EB%8B%89%EC%8A%A4";

  assert.equal(
    buildLoginHref("/compare", interleaved),
    buildLoginHref("/compare", grouped)
  );
  assert.equal(
    buildLoginHref("/compare", interleaved),
    buildLoginHref("/compare", interleaved)
  );
});

test("생성된 redirect는 기존 안전한 내부 URL 검증을 통과한다", () => {
  const redirect = getLoginRedirect(
    buildLoginHref("/compare", "company=005930&company=000660")
  );

  assert.equal(resolveInternalLoginRedirect(redirect), redirect);
});
