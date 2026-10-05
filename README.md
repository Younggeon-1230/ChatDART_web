# ChatDART

재무제표를 처음 접하는 사용자도 기업의 재무 흐름을 이해하기 쉽도록 돕는 **재무제표 분석 보조 웹 서비스**입니다.

기업 검색부터 재무 요약, 상세 분석, 기업 비교, AI 해석까지 하나의 흐름으로 제공하며, 공시·재무 데이터를 단순 나열하는 대신 사용자가 핵심 변화와 확인 포인트를 빠르게 파악할 수 있도록 구성했습니다.

> 이 저장소는 이력서·포트폴리오 공개를 위한 **Frontend 스냅샷**입니다.  
> 실제 운영 비밀값, 내부 QA 정보, 데모 비밀번호 등은 포함하지 않습니다.

## Project Overview

- **프로젝트명**: ChatDART
- **형태**: 3인 팀 프로젝트
- **구성**: Frontend / Backend / AI
- **Frontend**: Next.js, React, TypeScript
- **목표**: 비전공자도 기업 재무정보의 핵심 변화와 비교 포인트를 직관적으로 확인할 수 있는 서비스 구현

### 담당 역할

프로젝트에서 **서비스 기획 및 Frontend 개발**을 담당했습니다.

- 회계 전공 지식을 바탕으로 프로젝트 주제와 핵심 기능 기획
- 재무 요약, 상세 분석, 기업 비교, AI 해석 등 서비스 흐름 설계
- 사용자 관점에서 화면 구조와 UX 개선안 제안 및 반영
- Next.js·TypeScript 기반 주요 화면 구현
- Backend API 및 AI 응답 연동
- Bearer 인증, 로그인 Redirect, 토큰 갱신 등 인증 흐름 구현
- 데이터 수집 상태 및 HTTP 오류 상태별 UX 처리
- 통합 QA, 반응형 UI 검증 및 배포 환경 점검

## Main Features

### 기업 검색

- KOSPI / KOSDAQ 기업 검색
- 검색 결과에서 재무 요약 및 상세 분석 화면으로 연결
- 최근 조회 기업 흐름 지원

### 재무 요약

- 최근 수년간 주요 재무지표 표시
- 데이터 수집 상태에 따른 loading / collection / completed 상태 처리
- 비로그인 사용자의 인증 필요 상태 안내

### 상세 분석

- 주요 재무 흐름 및 추세 시각화
- 수익성·현금흐름·비용구조 관련 분석 카드
- 재무 데이터 기반 규칙형 Insight
- 관련 공시 및 업종 비교 정보 연동

### AI 분석

- 수집된 재무 데이터를 기반으로 AI 해석 결과 표시
- 정상 응답뿐 아니라 제한, 데이터 부족, 일시적 장애 등 상태별 UI 제공
- Backend AI API와 Frontend 표시 로직 분리

### 기업 비교

- 복수 기업의 주요 재무지표 비교
- 비교 후보 추천
- 저장된 비교 결과를 공유 링크로 조회

### My Page / Watchlist

- 관심 기업 저장 및 삭제
- 기업별 메모
- Membership 한도 및 API 오류 상태 처리

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | lucide-react |
| Deployment support | Cloudflare / vinext |
| Testing | Node Test Runner |
| Quality | ESLint, TypeScript |

## Frontend Architecture

```text
Browser
  │
  ├─ Company Search
  ├─ Summary
  ├─ Detail
  ├─ Compare
  ├─ MyPage / Membership
  │
  ▼
Next.js Frontend
  │
  ├─ Bearer Authentication
  ├─ API response normalization
  ├─ Collection-state handling
  ├─ Error-state UX
  └─ Responsive presentation
  │
  ▼
Backend API
  ├─ Financial data
  ├─ Authentication
  ├─ Watchlist / Membership
  └─ AI analysis
```

## Key Implementation Points

### 1. Bearer 인증 기반 API 연동

Finance API는 로그인 후 발급된 Bearer Token을 사용합니다.  
과거 사용하던 클라이언트 측 `X-API-Key` 방식은 제거했으며, 공개 저장소에는 실제 Secret을 포함하지 않습니다.

### 2. 데이터 수집 상태 처리

기업 데이터가 즉시 준비되지 않는 경우를 고려하여 다음과 같은 상태를 구분합니다.

```text
none → pending → processing → completed
                         └→ failed
```

Frontend는 `collection_status`를 기준으로 수집 요청과 재조회 흐름을 제어합니다.

### 3. API 오류별 사용자 경험

단순한 공통 오류 메시지 대신 인증, 데이터 수집, AI 처리 상황에 따라 사용자에게 필요한 다음 행동을 안내하도록 구성했습니다.

예:

- 인증 필요
- 수집할 데이터 없음
- 데이터 준비 중
- 요청 제한
- AI 분석 일시적 이용 불가

### 4. API 응답 정규화

Backend 응답을 화면 컴포넌트에서 직접 처리하지 않고 변환·정규화 계층을 두어 UI 코드와 API 계약을 분리했습니다.

### 5. 반응형 UI

주요 서비스 화면을 모바일부터 데스크톱까지 확인하며 레이아웃과 차트 overflow를 조정했습니다.

주요 QA 폭:

```text
360 / 390 / 430 / 768 / 1280px
```

## Routes

| Route | Description |
| --- | --- |
| `/` | Home / 기업 검색 |
| `/summary` | 재무 요약 |
| `/detail` | 상세 분석 |
| `/compare` | 기업 비교 |
| `/compare/share/[share_id]` | 비교 결과 공유 |
| `/mypage` | Watchlist / 사용자 정보 |
| `/membership` | Membership |
| `/login` | 로그인 |
| `/signup` | 회원가입 |

## Local Development

### 1. Install

```bash
npm install
```

### 2. Environment

`.env.example`을 참고해 로컬 환경을 설정합니다.

예시:

```env
NEXT_PUBLIC_API_ORIGIN=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_V1_BASE_URL=http://localhost:8000/api/v1
UPSTREAM_API_ORIGIN=http://localhost:8000
```

실제 API Key, Token, Password 등의 비밀값은 저장소에 커밋하지 않습니다.

### 3. Run

```bash
npm run dev
```

기본 개발 주소:

```text
http://localhost:3000
```

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
```

## Repository Policy

이 저장소는 포트폴리오 공개용 Frontend 저장소입니다.

- 운영 Secret 미포함
- 데모 계정 비밀번호 미포함
- 실제 운영 인프라 주소 미포함
- `.env` 계열 로컬 환경 파일 Git 제외
- 공개 가능한 소스와 문서만 유지

## Project Background

ChatDART는 단순히 숫자를 보여주는 재무제표 조회 사이트가 아니라, **회계 정보를 잘 모르는 사용자도 기업의 재무 흐름을 이해할 수 있도록 돕는 것**을 목표로 시작했습니다.

서비스 기획 단계에서 회계 전공 경험을 활용해 재무제표에서 사용자가 실제로 궁금해할 변화와 비교 포인트를 정의하고, 이를 Frontend 화면과 Backend·AI 기능으로 연결하는 방식으로 개발했습니다.
