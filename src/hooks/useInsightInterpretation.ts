"use client";

import { useEffect, useRef, useState } from "react";
import {
  createIdleInsightInterpretationState,
  getInsightInterpretationFlowEntry,
  type InsightInterpretationCache,
  type InsightInterpretationFlowInput,
  type InsightInterpretationViewState,
} from "@/lib/insightInterpretationFlow";

export function useInsightInterpretation(
  input: InsightInterpretationFlowInput
): InsightInterpretationViewState {
  const [state, setState] = useState<InsightInterpretationViewState>(
    createIdleInsightInterpretationState
  );
  const activeRequestKeyRef = useRef<string | null>(null);
  const cacheRef = useRef<InsightInterpretationCache>(new Map());

  useEffect(() => {
    let isMounted = true;
    const flowEntry = getInsightInterpretationFlowEntry(input, cacheRef.current);

    if (!flowEntry) {
      activeRequestKeyRef.current = null;
      // Synchronize the displayed interpretation with the current Detail target.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(createIdleInsightInterpretationState());
      return;
    }

    const { requestKey, cacheEntry } = flowEntry;
    activeRequestKeyRef.current = requestKey;

    if (cacheEntry.result) {
      setState(cacheEntry.result);
    } else {
      setState({
        status: "loading",
        interpretation: null,
        errorText: "",
      });

      void cacheEntry.promise.then((result) => {
        if (!isMounted || activeRequestKeyRef.current !== requestKey) return;

        setState(result);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [input]);

  return state;
}
