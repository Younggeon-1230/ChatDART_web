"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/common/Button";
import { AuthCard } from "@/components/common/Card";
import { FormField, TextInput } from "@/components/common/Form";
import { register } from "@/lib/api";
import {
  getAuthErrorMessage,
  validatePasswordPolicy,
  validateSignupForm,
} from "@/lib/authForm";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    ReturnType<typeof validateSignupForm>
  >({});
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordHints = validatePasswordPolicy(password);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    const nextFieldErrors = validateSignupForm({
      email,
      password,
      passwordConfirm,
      termsAgreed,
    });
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      await register({
        email: email.trim(),
        password,
        nickname: nickname.trim() || undefined,
        terms_agreed: termsAgreed,
      });
      router.push(`/login?registered=1&email=${encodeURIComponent(email.trim())}`);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, "signup"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-4xl items-center justify-center px-4 py-10">
      <AuthCard>
        <div>
          <p className="text-sm font-medium text-slate-500">계정</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            회원가입
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            이메일과 비밀번호로 ChatDart 계정을 만듭니다.
          </p>
        </div>

        {errorText && (
          <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
            {errorText}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormField
            label="이메일"
            htmlFor="signup-email"
            errorText={fieldErrors.email}
          >
            <TextInput
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={isSubmitting}
              invalid={!!fieldErrors.email}
            />
          </FormField>

          <FormField label="닉네임" htmlFor="signup-nickname" helperText="선택 입력입니다.">
            <TextInput
              id="signup-nickname"
              type="text"
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="표시 이름"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="비밀번호"
            htmlFor="signup-password"
            helperText={
              password && passwordHints.length === 0
                ? "사용 가능한 비밀번호입니다."
                : "10자 이상, 글자/숫자/특수문자 포함, 공백 없이 입력해 주세요."
            }
            errorText={fieldErrors.password}
          >
            <TextInput
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              disabled={isSubmitting}
              invalid={!!fieldErrors.password}
            />
          </FormField>

          <FormField
            label="비밀번호 확인"
            htmlFor="signup-password-confirm"
            errorText={fieldErrors.passwordConfirm}
          >
            <TextInput
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="비밀번호 재입력"
              disabled={isSubmitting}
              invalid={!!fieldErrors.passwordConfirm}
            />
          </FormField>

          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(event) => setTermsAgreed(event.target.checked)}
                disabled={isSubmitting}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-200"
              />
              <span>ChatDart 이용 약관과 개인정보 처리 안내에 동의합니다.</span>
            </label>
            {fieldErrors.termsAgreed && (
              <p className="text-xs leading-5 text-red-600">
                {fieldErrors.termsAgreed}
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            회원가입
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-blue-900 hover:text-blue-700">
            로그인
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
