"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/common/Card";
import { logoutCurrentUser } from "@/lib/api";
import { resolveInternalLogoutRedirect } from "@/lib/authRedirect";

export default function LogoutPage() {
  const router = useRouter();
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function runLogout() {
      const redirect = resolveInternalLogoutRedirect(
        new URLSearchParams(window.location.search).get("redirect")
      );

      try {
        await logoutCurrentUser();
      } catch {
        if (isMounted) {
          setErrorText("로그아웃 요청을 완료하지 못했지만, 저장된 로그인 정보는 정리했습니다.");
        }
      } finally {
        if (isMounted) {
          router.replace(redirect);
          router.refresh();
        }
      }
    }

    void runLogout();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-4xl items-center justify-center px-4 py-10">
      <AuthCard>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          로그아웃 중입니다.
        </div>
        {errorText && (
          <p className="mt-4 text-sm leading-6 text-red-600">{errorText}</p>
        )}
      </AuthCard>
    </div>
  );
}
