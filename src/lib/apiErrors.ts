import type { ApiErrorResponse } from "@/types/api";

type ErrorWithStatus = Error & {
  status?: number;
  userMessage?: string;
};

type ParsedApiError = {
  message: string;
  validationMessages: string[];
};

export type FinanceServiceUnavailableKind =
  | "loading"
  | "init_failed"
  | "generic_503";

const DEFAULT_API_ERROR_MESSAGE =
  "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

function cleanMessage(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function parseApiErrorBody(errorBody: unknown): ParsedApiError {
  if (!errorBody || typeof errorBody !== "object") {
    return {
      message: "",
      validationMessages: [],
    };
  }

  const body = errorBody as ApiErrorResponse;
  const validationMessages: string[] = [];

  if (typeof body.detail === "string") {
    const detail = cleanMessage(body.detail);
    if (detail) {
      return { message: detail, validationMessages };
    }
  }

  if (Array.isArray(body.detail)) {
    body.detail.forEach((item) => {
      const message = cleanMessage(item.msg) || cleanMessage(item.message);
      if (message) validationMessages.push(message);
    });

    if (validationMessages.length > 0) {
      return {
        message: validationMessages[0],
        validationMessages,
      };
    }
  }

  const message =
    cleanMessage(body.message) ||
    cleanMessage(body.error) ||
    body.errors?.map((item) => cleanMessage(item.message)).find(Boolean) ||
    "";

  return {
    message,
    validationMessages,
  };
}

export function getApiErrorStatus(error: unknown) {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

export function getApiStatusMessage(
  status: number | undefined,
  fallback = DEFAULT_API_ERROR_MESSAGE
) {
  switch (status) {
    case 400:
      return "요청 형식이 올바르지 않습니다.";
    case 401:
      return "로그인 후 이용해 주세요.";
    case 403:
      return "요청 권한이 없습니다.";
    case 404:
      return "요청한 데이터를 찾지 못했습니다.";
    case 408:
      return "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
    case 422:
      return "입력값 형식이 올바르지 않습니다.";
    case 429:
      return "요청이 잠시 많습니다. 조금 뒤 다시 시도해 주세요.";
    case 503:
      return "서비스를 잠시 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    default:
      if (typeof status === "number" && status >= 500) {
        return "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }

      return fallback;
  }
}

export function getApiErrorMessage(
  error: unknown,
  fallback = DEFAULT_API_ERROR_MESSAGE
) {
  const err = error as Partial<ErrorWithStatus>;
  const status = getApiErrorStatus(error);

  if (status === 401) {
    return getApiStatusMessage(status, fallback);
  }

  const explicitMessage = cleanMessage(err.userMessage);

  if (explicitMessage) {
    return explicitMessage;
  }

  if (error instanceof TypeError) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return getApiStatusMessage(status, fallback);
}

function getExplicitErrorMessage(error: unknown) {
  const err = error as Partial<ErrorWithStatus>;
  return cleanMessage(err.userMessage) || cleanMessage(err.message);
}

export function getFinanceServiceUnavailableKind(
  error: unknown
): FinanceServiceUnavailableKind | null {
  if (getApiErrorStatus(error) !== 503) {
    return null;
  }

  const message = getExplicitErrorMessage(error);

  if (
    message.includes("DART 기업 리스트 초기화에 실패") ||
    message.includes("초기화에 실패")
  ) {
    return "init_failed";
  }

  if (message.includes("기업 리스트 로딩 중")) {
    return "loading";
  }

  return "generic_503";
}

export function isFinanceDartLoadingError(error: unknown) {
  return getFinanceServiceUnavailableKind(error) === "loading";
}

export function isFinanceDartInitFailedError(error: unknown) {
  return getFinanceServiceUnavailableKind(error) === "init_failed";
}

export function isRateLimitError(error: unknown) {
  return getApiErrorStatus(error) === 429;
}
