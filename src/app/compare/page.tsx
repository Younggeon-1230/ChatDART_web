"use client";

import { Suspense } from "react";
import { ComparePageContent } from "@/app/compare/ComparePageContent";

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <ComparePageContent />
    </Suspense>
  );
}
