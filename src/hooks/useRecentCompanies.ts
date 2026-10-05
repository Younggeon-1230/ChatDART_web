"use client";

import { useEffect, useState } from "react";
import {
  getRecentCompanies,
  type RecentCompany,
} from "@/lib/recentCompanies";

export function useRecentCompanies() {
  const [companies, setCompanies] = useState<RecentCompany[]>([]);

  useEffect(() => {
    const sync = () => {
      setCompanies(getRecentCompanies());
    };

    sync();

    window.addEventListener("storage", sync);
    window.addEventListener("recentCompaniesUpdated", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("recentCompaniesUpdated", sync);
    };
  }, []);

  return companies;
}
