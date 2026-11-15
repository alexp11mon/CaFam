"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/** What the calendar puts in the phone header (spec 016 RF-8, RF-10, RF-20, RF-23). */
export interface CalendarHeaderState {
  title: string;
  /** Today in the profile's time zone, for the number of the "Hoy" button (RF-9). */
  today: string;
  onToday: (() => void) | null;
  /** The month row in the month view, the mini month in the others. */
  picker: "months" | "mini" | null;
}

interface HeaderContext {
  /** Null outside the calendar: the header shows the section name. */
  state: CalendarHeaderState | null;
  publish: (state: CalendarHeaderState | null) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  /** Where the calendar mounts its filters inside the sheet (spec 016 plan D3). */
  drawerSlot: HTMLElement | null;
  setDrawerSlot: (slot: HTMLElement | null) => void;
  /** The sheet of calendars and filters of the phone (spec 026 RF-4). */
  sheet: RefObject<HTMLDialogElement | null>;
  /** Opens it; the focus goes back to `opener` when it closes. */
  openSheet: (opener?: HTMLElement | null) => void;
  /** For the sheet: gives the focus back. */
  sheetClosed: () => void;
}

const Context = createContext<HeaderContext | null>(null);

export function CalendarHeaderProvider({ children }: { children: ReactNode }) {
  const [state, publish] = useState<CalendarHeaderState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<HTMLElement | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const value = useMemo(
    () => ({
      state,
      publish,
      pickerOpen,
      setPickerOpen,
      drawerSlot,
      setDrawerSlot,
      sheet,
      openSheet: (from?: HTMLElement | null) => {
        opener.current = from ?? null;
        sheet.current?.showModal();
      },
      sheetClosed: () => opener.current?.focus(),
    }),
    [state, pickerOpen, drawerSlot],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const OUTSIDE: HeaderContext = {
  state: null,
  publish: () => {},
  pickerOpen: false,
  setPickerOpen: () => {},
  drawerSlot: null,
  setDrawerSlot: () => {},
  sheet: { current: null },
  openSheet: () => {},
  sheetClosed: () => {},
};

export function useCalendarHeader(): HeaderContext {
  return useContext(Context) ?? OUTSIDE;
}

/**
 * Publishes the calendar's header while mounted and clears it on cleanup, which
 * also runs when Activity hides the page (plan D15). "Hoy" always calls the
 * latest function without publishing again on every render.
 */
export function usePublishCalendarHeader({
  title,
  today: todayKey,
  onToday,
  picker,
}: CalendarHeaderState) {
  const { publish } = useCalendarHeader();
  const today = useRef(onToday);
  useEffect(() => {
    today.current = onToday;
  });
  const hasToday = onToday !== null;

  useEffect(() => {
    publish({
      title,
      today: todayKey,
      picker,
      onToday: hasToday ? () => today.current?.() : null,
    });
  }, [publish, title, todayKey, picker, hasToday]);

  useEffect(() => () => publish(null), [publish]);
}
