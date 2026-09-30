"use client";

import { useEffect, useState } from "react";
import { getGovernanceTotalStaked } from "@/action/pythActions";

export function useGovernanceTotalStaked() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    total: number | null;
    isLoading: boolean;
  }>({ total: null, isLoading: true });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const total = await getGovernanceTotalStaked();
        if (!cancelled) setState({ total, isLoading: false });
      } catch {
        if (!cancelled) setState({ total: null, isLoading: false });
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [attempt]);

  function retry() {
    setState({ total: null, isLoading: true });
    setAttempt((value) => value + 1);
  }

  return { ...state, retry };
}
