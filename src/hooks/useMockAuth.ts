"use client";

import type { UserPlan } from "@/lib/featureAccess";

function getMockPlan(): UserPlan {
  return "premium";
}

export function useMockAuth() {
  const plan = getMockPlan();

  return {
    isLoggedIn: plan !== "guest",
    plan,
  };
}
