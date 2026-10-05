export type UserPlan = "guest" | "free" | "premium";

export type FeatureKey =
  | "summary"
  | "detailAnalysis"
  | "companyCompare"
  | "aiReport"
  | "chatbot";

const ENABLE_AUTH_GUARD = false;

export function canUseFeature(plan: UserPlan, feature: FeatureKey) {
  if (!ENABLE_AUTH_GUARD) {
    return true;
  }

  if (plan === "premium") {
    return true;
  }

  if (plan === "free") {
    return (
      feature === "summary" ||
      feature === "detailAnalysis" ||
      feature === "companyCompare"
    );
  }

  return feature === "summary";
}
