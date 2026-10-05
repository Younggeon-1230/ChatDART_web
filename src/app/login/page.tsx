"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/common/Button";
import { AuthCard } from "@/components/common/Card";
import { FormField, TextInput } from "@/components/common/Form";
import { login } from "@/lib/api";
import { resolveInternalLoginRedirect } from "@/lib/authRedirect";
import { getAuthErrorMessage } from "@/lib/authForm";
import { storeAuthTokens } from "@/lib/authTokens";

const DEMO_EMAIL = "demo@chatdart.app";
type LoginCredentials = {
  email: string;
  password: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registered = searchParams.get("registered") === "1";
  const redirectTo = useMemo(
    () => resolveInternalLoginRedirect(searchParams.get("redirect")),
    [searchParams]
  );

  async function submitLogin(credentials?: LoginCredentials) {
    setErrorText("");

    const nextEmail = credentials?.email ?? email;
    const nextPassword = credentials?.password ?? password;
    const normalizedEmail = nextEmail.trim();

    if (!normalizedEmail || !nextPassword) {
      setErrorText("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await login({
        email: normalizedEmail,
        password: nextPassword,
      });
      storeAuthTokens(response);
      router.push(redirectTo);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, "login"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitLogin();
  }

  function handleDemoLogin() {
    setEmail(DEMO_EMAIL);
    setPassword("");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-4xl items-center justify-center px-4 py-10">
      <AuthCard>
        <div>
          <p className="text-sm font-medium text-slate-500">계정</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            로그인
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            로그인하면 즐겨찾기와 대시보드 기능을 사용할 수 있습니다.
          </p>
        </div>

        {registered && (
          <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-700">
            회원가입이 완료되었습니다. 가입한 계정으로 로그인해 주세요.
          </div>
        )}

        {errorText && (
          <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
            {errorText}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormField label="이메일" htmlFor="login-email">
            <TextInput
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="비밀번호" htmlFor="login-password">
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              disabled={isSubmitting}
            />
          </FormField>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-5 text-slate-500">
                데모 계정 이메일을 입력합니다. 비밀번호는 별도로 입력해 주세요.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDemoLogin}
                disabled={isSubmitting}
              >
                데모 이메일 입력
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            로그인
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          아직 계정이 없나요?{" "}
          <Link href="/signup" className="font-semibold text-blue-900 hover:text-blue-700">
            회원가입
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-4xl items-center justify-center px-4 py-10">
          <AuthCard>
            <p className="text-sm text-slate-500">로그인 화면을 준비하고 있습니다.</p>
          </AuthCard>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
