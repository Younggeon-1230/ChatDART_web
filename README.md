# ChatDART

**ChatDART는 금융감독원 전자공시시스템(DART)의 공시·재무 데이터를 활용해 기업의 재무 흐름을 시각화하고, 주요 변화에 대한 AI 해석을 함께 제공하는 대시보드형 재무분석 보조 서비스입니다.**

기업 검색부터 재무 요약, 상세 분석, 기업 비교까지 하나의 흐름으로 제공하며, AI는 별도 챗봇이 아니라 재무 데이터에서 확인된 주요 신호를 이해하기 쉽게 설명하는 보조 기능으로 사용했습니다.

> **Public portfolio snapshot**  
> 이 저장소는 기존 Private 팀 저장소의 Frontend 소스를 포트폴리오 공개용으로 정리해 별도 Public 저장소로 이전한 스냅샷입니다. 원본 저장소에는 팀 개발·운영 관련 이력이 포함되어 있어 비공개로 유지하며, 공개 저장소에는 현재 Frontend 소스만 옮겨 Git 히스토리를 새로 구성했습니다.  
> 실제 운영 Secret, 내부 QA 정보, 데모 비밀번호 등은 포함하지 않습니다.

## Project Overview

- **프로젝트명**: ChatDART
- **형태**: 3인 팀 프로젝트
- **팀 구성**: Frontend / Backend / AI
- **Frontend**: Next.js, React, TypeScript
- **목표**: 재무정보에 익숙하지 않은 사용자도 기업의 핵심 재무 변화와 비교 포인트를 직관적으로 확인할 수 있는 서비스 구현
- **데이터 맥락**: 금융감독원 DART 공시·재무 데이터를 기반으로 Backend에서 가공한 API 사용

## My Role

프로젝트에서 **서비스 기획을 주도하고 Frontend 개발을 담당**했습니다.

### 직접 담당

- 회계 전공 지식을 바탕으로 프로젝트 주제 제안 및 핵심 기능 기획
- 재무 요약, 상세 분석, 기업 비교, AI 해석 등 사용자 흐름과 화면 구조 설계
- 사용자 관점에서 UX 개선안 제안 및 반영
- Next.js·TypeScript 기반 주요 화면과 공통 UI 구현
- Bearer 인증, 로그인 Redirect, 토큰 갱신 등 Frontend 인증 흐름 구현
- 데이터 수집 상태 polling 및 HTTP 오류 상태별 UX 처리
- API 응답 정규화와 화면 표시 로직 구현
- 반응형 UI, 통합 QA 및 배포 환경 점검

### 팀 협업 범위

- **Backend**: Backend 팀이 구현한 인증·재무·Watchlist·Membership API 계약을 Frontend에 연동하고 예외 케이스를 함께 조율
- **AI**: AI 팀이 제공한 분석·해석 응답을 Frontend 화면에 통합하고 표시 규칙 및 UX를 검증
- Backend 서버 로직과 AI 모델 자체 구현은 각 담당 팀원이 수행

## Main Features

### 기업 검색

- KOSPI / KOSDAQ 기업 검색
- 검색 결과에서 재무 요약 및 상세 분석 화면으로 연결
- 최근 조회 기업 흐름 지원

### 재무 요약

- 최근 수년간 주요 재무지표 표시
- 데이터 수집 상태에 따른 `none / pending / processing / completed / failed` 흐름 처리
- 비로그인 사용자의 인증 필요 상태 안내

### 상세 분석

- 주요 재무 흐름 및 추세 시각화
- 수익성·현금흐름·비용구조 관련 분석 카드
- 재무 데이터 기반 규칙형 Insight
- 관련 공시 및 업종 비교 정보 연동

### AI 해석

- 수집된 재무 데이터와 규칙형 Insight를 바탕으로 해석 결과 표시
- AI는 별도 챗봇이 아니라 분석 화면의 보조 해석 기능으로 구성
- 정상 응답뿐 아니라 데이터 부족, 제한, 일시적 장애 등 상태별 UI 제공
- AI API 응답과 Frontend 표시 로직 분리

### 기업 비교

- 복수 기업의 주요 재무지표 비교
- 유사기업·비교 후보 추천
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
| Deployment support | Cloudflare, vinext, Vite |
| Testing | Node Test Runner |
| Quality | ESLint, TypeScript |

> 애플리케이션 자체는 **Next.js 기반**입니다. `vinext`와 `Vite` 관련 설정은 Cloudflare 환경에 배포하기 위한 별도 빌드·런타임 어댑터 구성에 사용했습니다.

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
  ├─ DART-based financial data
  ├─ Authentication
  ├─ Watchlist / Membership
  └─ AI analysis / interpretation
```

## Key Implementation Points

### 1. Bearer 인증 기반 API 연동

Finance API는 로그인 후 발급된 Bearer Token을 사용합니다. 과거 클라이언트 환경변수에 의존하던 `X-API-Key` 방식은 제거하고, 인증이 필요한 API와 공개 API를 구분해 요청하도록 정리했습니다.

### 2. 데이터 수집 상태 처리

기업 데이터가 즉시 준비되지 않는 경우를 고려하여 다음 상태를 구분합니다.

```text
none → pending → processing → completed
                         └→ failed
```

Frontend는 `collection_status`와 수집 상태 API를 기준으로 최초 수집, polling, 완료, 실패 흐름을 제어합니다.

### 3. API 오류별 사용자 경험

모든 실패를 하나의 오류 메시지로 처리하지 않고 인증, 데이터 수집, AI 처리 상황에 따라 다음 행동이 달라지도록 구성했습니다.

- 인증 필요
- 데이터 수집 필요
- 데이터 준비 중
- 권한·사용량 제한
- AI 분석 일시적 이용 불가

### 4. API 응답 정규화

Backend 응답을 각 화면에서 직접 가공하지 않고 Frontend 변환·정규화 계층을 두어 API 계약과 UI 표시 로직을 분리했습니다.

### 5. 반응형 UI

모바일부터 데스크톱까지 주요 화면의 레이아웃, 표·차트 overflow, 네비게이션을 점검했습니다.

주요 QA 폭:

```text
360 / 390 / 430 / 768 / 1280px
```

## Troubleshooting & Decisions

실제 Backend·AI 연동 과정에서 발견한 계약 불일치와 예외 케이스를 별도 문서로 정리했습니다.

- [`docs/troubleshooting.md`](docs/troubleshooting.md) — 데이터 수집 404 처리, 중복 수집 방지, 인증 방식 정리, AI 증감률 정규화

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

- 기존 Private 팀 저장소에서 공개 가능한 현재 소스만 분리
- 운영 Secret 미포함
- 데모 계정 비밀번호 미포함
- 실제 운영 인프라 주소 미포함
- `.env` 계열 로컬 환경 파일 Git 제외
- 공개 가능한 소스와 문서만 유지

## Project Background

ChatDART는 단순히 재무 숫자를 나열하는 조회 사이트가 아니라, **회계 정보를 잘 모르는 사용자도 기업의 재무 흐름과 변화 이유를 파악하는 데 도움을 주는 것**을 목표로 시작했습니다.

서비스 기획 단계에서 회계 전공 경험을 활용해 사용자가 실제로 궁금해할 재무 변화와 비교 포인트를 정의하고, 이를 Frontend 화면과 Backend·AI 기능으로 연결하는 방식으로 개발했습니다.

> 주요 서비스 화면과 데모 링크는 포트폴리오 공개 범위를 정리한 뒤 추가할 예정입니다.
