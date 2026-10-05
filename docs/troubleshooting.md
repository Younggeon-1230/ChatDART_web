# ChatDART Frontend Troubleshooting & Technical Decisions

이 문서는 ChatDART Frontend를 Backend·AI와 통합하면서 실제로 확인한 문제와 해결 방향을 포트폴리오 관점에서 정리한 기록입니다.

Backend 서버 로직이나 AI 모델 자체를 구현한 문서가 아니라, **Frontend에서 API 계약을 해석하고 사용자 흐름을 안정적으로 만드는 과정**에 초점을 둡니다.

---

## 1. 미수집 기업에서 `404` 때문에 데이터 수집이 시작되지 않던 문제

### 문제

Frontend는 미수집 기업의 상세 API가 다음처럼 응답할 것으로 예상했습니다.

```text
HTTP 200
collection_status: "none"
```

그러나 일부 기업에서는 Backend가 다음 의미의 응답을 반환했습니다.

```text
HTTP 404
"데이터 수집이 필요합니다."
```

기존 흐름에서는 상세 API의 `404`가 일반 오류로 처리되어 이후 `/collect` 요청까지 진행되지 않았습니다.

### 원인

Frontend와 Backend가 **"데이터가 아직 수집되지 않은 상태"를 서로 다른 방식으로 표현**하고 있었습니다.

```text
Frontend 예상
200 + collection_status: none

실제 일부 응답
404 + 데이터 수집 필요
```

즉 네트워크 장애가 아니라 API 계약의 상태 표현 차이였습니다.

### 해결

Summary와 Detail의 수집 흐름을 별도 helper로 분리하고 `404`를 무조건 수집 신호로 취급하지 않도록 했습니다.

- Summary
  - detail 요청이 `404`이면 collection status API로 상태를 재확인
  - `none`인 경우에만 수집 시작
  - `pending / processing`은 polling 유지
  - `completed`이면 detail 재조회
  - `failed`는 종료 상태로 처리
- Detail
  - `404`이면서 사용자 메시지가 정확히 `"데이터 수집이 필요합니다."`인 경우만 `needs_collection`으로 분류
  - 일반적인 "기업을 찾을 수 없음" `404`는 기존 오류 흐름 유지
- `401 / 403 / 429 / 503` 같은 다른 HTTP 오류가 수집 흐름으로 잘못 진입하지 않도록 테스트 추가

관련 코드:

```text
src/lib/summaryCollectionFlow.ts
src/lib/detailCollectionFlow.ts
tests/summaryCollectionFlow.test.ts
tests/detailCollectionFlow.test.ts
```

### 결과

"미수집"과 "존재하지 않는 기업/일반 오류"를 구분해 처리하게 되었고, API 응답 방식이 달라도 수집 여부를 명확히 결정할 수 있게 됐습니다.

### 배운 점

HTTP status 하나만 보고 사용자 상태를 결정하기보다, **도메인 상태와 API 계약을 함께 모델링해야 한다**는 점을 확인했습니다.

---

## 2. 수집 실패 후 재시도에서 중복 요청이 발생할 수 있는 문제

### 문제

수집 실패 상태에서 사용자가 재시도 버튼을 빠르게 여러 번 누르면 `/collect` 요청이 중복으로 전송될 가능성이 있었습니다.

또한 실패한 수집을 자동으로 계속 재시도하면 Backend 부하와 예측하기 어려운 사용자 경험으로 이어질 수 있었습니다.

### 해결

재시도 로직에 요청 잠금 상태를 두었습니다.

```text
첫 클릭     → collection 요청
두 번째 클릭 → skipped
요청 종료    → lock 해제
```

그리고 `failed`는 terminal state로 유지하여 자동 수집을 반복하지 않고 **사용자의 명시적인 재시도**에서만 다시 요청하도록 했습니다.

관련 코드:

```text
retryFailedSummaryCollection()
isTerminalSummaryPollResult()
tests/summaryCollectionFlow.test.ts
```

테스트에서는 다음 상황을 검증했습니다.

- 빠른 연속 클릭에서도 collection 요청은 한 번만 발생
- 요청 실패 후 lock 정상 해제
- 재시도 후 다시 실패해도 자동 재수집하지 않음
- `pending / processing` 상태에서는 새 collection 요청을 만들지 않음

### 결과

Frontend polling과 사용자 재시도가 동시에 작동해 중복 수집을 만들 가능성을 줄이고, 수집 상태 전이를 예측 가능하게 유지했습니다.

---

## 3. Frontend의 인증 방식을 `X-API-Key`에서 Bearer 중심으로 정리

### 문제

초기 개발 과정에는 Frontend 환경변수 기반의 `X-API-Key` 요청 코드가 존재했습니다.

그러나 브라우저에서 사용하는 `NEXT_PUBLIC_*` 환경변수는 사용자에게 노출될 수 있으므로 서버 Secret을 저장하는 방식으로 적절하지 않습니다.

최종 API 계약에서는 Finance API 역시 로그인 사용자의 Bearer 인증을 사용하게 됐습니다.

### 해결

Frontend에서 기존 API Key 의존성을 제거하고 인증 방식을 정리했습니다.

- 로그인 후 Access Token 저장
- 보호된 API는 `Authorization: Bearer ...` 사용
- 만료 시 Refresh Token 기반 갱신
- Finance collection/status 요청에도 `X-API-Key`를 보내지 않음
- Public 포트폴리오에는 실제 Secret과 운영 환경값을 포함하지 않음

관련 코드:

```text
src/lib/api.ts
src/lib/authTokens.ts
tests/summaryCollectionFlow.test.ts
```

### 결과

사용자 인증과 서버 Secret의 역할이 분리됐으며, Frontend 소스를 공개해도 운영 Secret에 의존하지 않는 구조로 정리할 수 있었습니다.

---

## 4. AI 해석에 원시 부동소수점 증감률이 전달되던 문제

### 문제

재무 증감률을 계산한 값이 그대로 AI 해석 요청에 전달되면 다음과 같이 불필요하게 긴 부동소수점 값이 사용자 문구에 반영될 수 있었습니다.

```text
19.465031020551713%
```

재무 대시보드의 다른 화면에서는 소수점 자릿수를 제한하고 있었기 때문에 표시 정밀도도 일관되지 않았습니다.

### 원인

JavaScript의 부동소수점 계산 결과를 Frontend 표시·AI 요청 경계에서 별도로 정규화하지 않았기 때문입니다.

### 해결

AI interpretation payload를 만들 때 `changeRate`를 canonical value로 변환하도록 처리했습니다.

```ts
const roundedMagnitude =
  Math.round(
    (magnitude + Number.EPSILON * Math.max(1, magnitude)) * 100
  ) / 100;
```

추가로 다음 계약을 구분했습니다.

- 숫자가 있으면 소수 둘째 자리 수준으로 정규화
- Backend가 명시적으로 `null`을 준 경우 `null` 유지
- 값 자체가 없는 경우 필드 생략

관련 코드:

```text
src/lib/api.ts
tests/insightInterpretationRequest.test.ts
```

### 결과

Frontend 화면과 AI 해석에 전달되는 증감률의 표현 기준을 맞추고, API의 `null` 의미도 보존할 수 있게 됐습니다.

---

## 5. Next.js 프로젝트에 Vite 설정이 함께 존재하는 이유

이 프로젝트의 애플리케이션 프레임워크는 **Next.js**입니다.

`vite.config.ts`, `vinext`, `@cloudflare/vite-plugin`은 별도의 Frontend 프레임워크를 혼용하기 위한 것이 아니라 **Next.js 애플리케이션을 Cloudflare 환경에 배포하기 위한 빌드·런타임 어댑터 구성**입니다.

```text
Next.js application
        │
        ▼
      vinext
        │
        ▼
Vite / Cloudflare plugin
        │
        ▼
Cloudflare runtime
```

관련 코드:

```text
vite.config.ts
cloudflare.config.ts
scripts/vinext-cloudflare.mjs
```

포트폴리오에서 Vite와 Next.js가 함께 보이는 이유를 명확하게 하기 위해 이 결정을 기록했습니다.

---

## What I focused on

이 프로젝트에서 Frontend 담당자로서 단순히 API 호출 코드를 연결하는 데 그치지 않고 다음을 중점적으로 확인했습니다.

- Backend의 상태 표현과 Frontend 사용자 흐름이 일치하는가
- 동일한 HTTP status라도 도메인 의미를 구분해야 하는가
- 실패·재시도에서 중복 요청이 발생하지 않는가
- AI로 전달되는 재무 값의 표현 기준이 UI와 일치하는가
- 브라우저에 노출되는 값과 서버 Secret의 경계가 적절한가
- 실제 운영 환경에서 발생하는 예외가 사용자에게 이해 가능한 상태로 표현되는가
