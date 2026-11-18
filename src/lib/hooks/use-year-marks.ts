"use client";

import { useEffect, useState } from "react";
import type { MonthMarks } from "@/lib/calendar/month-marks";

export type LoadYearMarks = (
  year: number,
) => Promise<{ marks: MonthMarks } | { error: string }>;

interface YearsState {
  years: ReadonlyMap<number, MonthMarks>;
  failed: ReadonlySet<number>;
}

function read(
  load: LoadYearMarks,
  year: number,
): Promise<{ marks: MonthMarks } | null> {
  return load(year).then(
    (result) => ("error" in result ? null : result),
    () => null,
  );
}

function stored(
  current: YearsState,
  year: number,
  marks: MonthMarks,
): YearsState {
  const failed = new Set(current.failed);
  failed.delete(year);
  return { years: new Map(current.years).set(year, marks), failed };
}

/**
 * The marks of a year, kept for the session; the next year is read when the
 * browser is idle, so moving on paints at once (spec 042 RF-4, RNF-1).
 */
export function useYearMarks(year: number, load: LoadYearMarks | undefined) {
  const [state, setState] = useState<YearsState>({
    years: new Map(),
    failed: new Set(),
  });
  const [attempt, setAttempt] = useState(0);
  const known = state.years.has(year);
  const nextKnown = state.years.has(year + 1);

  useEffect(() => {
    if (!load || known) return;
    void read(load, year).then((result) =>
      setState((current) =>
        result
          ? stored(current, year, result.marks)
          : { ...current, failed: new Set(current.failed).add(year) },
      ),
    );
  }, [year, known, load, attempt]);

  useEffect(() => {
    if (!load || !known || nextKnown) return;
    const idle = window.requestIdleCallback ?? ((run) => setTimeout(run, 200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    // A failed preload is quiet: the year is asked again when shown.
    const handle = idle(
      () =>
        void read(load, year + 1).then((result) => {
          if (result)
            setState((current) => stored(current, year + 1, result.marks));
        }),
    );
    return () => cancel(handle as number);
  }, [year, known, nextKnown, load]);

  return {
    marks: state.years.get(year),
    failed: state.failed.has(year) && !known,
    retry: () => {
      setState((current) => {
        const failed = new Set(current.failed);
        failed.delete(year);
        return { ...current, failed };
      });
      setAttempt((value) => value + 1);
    },
  };
}
