import { getApiErrorStatus } from "@/lib/apiErrors";

type AuthFormMode = "login" | "signup";

type FieldErrors = {
  email?: string;
  password?: string;
  passwordConfirm?: string;
  termsAgreed?: string;
};

function cleanMessage(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function validatePasswordPolicy(password: string) {
  const errors: string[] = [];
  const byteLength = new TextEncoder().encode(password).length;

  if (password.length < 10) errors.push("비밀번호는 10자 이상이어야 합니다.");
  if (!/[A-Za-z가-힣]/.test(password)) {
    errors.push("비밀번호에는 글자가 1개 이상 포함되어야 합니다.");
  }
  if (!/\d/.test(password)) {
    errors.push("비밀번호에는 숫자가 1개 이상 포함되어야 합니다.");
  }
  if (!/[^\w\s가-힣]/.test(password)) {
    errors.push("비밀번호에는 특수문자가 1개 이상 포함되어야 합니다.");
  }
  if (/\s/.test(password)) errors.push("비밀번호에는 공백을 사용할 수 없습니다.");
  if (byteLength > 72) errors.push("비밀번호는 72바이트 이하여야 합니다.");

  return errors;
}

export function validateSignupForm({
  email,
  password,
  passwordConfirm,
  termsAgreed,
}: {
  email: string;
  password: string;
  passwordConfirm: string;
  termsAgreed: boolean;
}) {
  const errors: FieldErrors = {};

  if (!email.trim()) errors.email = "이메일을 입력해 주세요.";
  if (!password) {
    errors.password = "비밀번호를 입력해 주세요.";
  } else {
    const passwordErrors = validatePasswordPolicy(password);
    if (passwordErrors.length > 0) errors.password = passwordErrors[0];
  }

  if (!passwordConfirm) {
    errors.passwordConfirm = "비밀번호 확인을 입력해 주세요.";
  } else if (password !== passwordConfirm) {
    errors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
  }

  if (!termsAgreed) {
    errors.termsAgreed = "약관 동의가 필요합니다.";
  }

  return errors;
}

export function getAuthErrorMessage(error: unknown, mode: AuthFormMode) {
  const status = getApiErrorStatus(error);
  const serverMessage =
    cleanMessage((error as { userMessage?: unknown })?.userMessage) ||
    cleanMessage((error as { message?: unknown })?.message);

  if (error instanceof TypeError) {
    return "서버에 연결할 수 없습니다.";
  }

  switch (status) {
    case 401:
      return mode === "login"
        ? "이메일 또는 비밀번호가 올바르지 않습니다."
        : serverMessage || "인증에 실패했습니다.";
    case 403:
      return serverMessage || "이메일 인증이 필요합니다.";
    case 409:
      return serverMessage || "이미 가입된 이메일입니다.";
    case 422:
      return serverMessage || "입력값을 다시 확인해 주세요.";
    case 429:
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    default:
      if (typeof status === "number" && status >= 500) {
        return "서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }

      return serverMessage || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
