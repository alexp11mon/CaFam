import { describe, expect, it } from "vitest";
import {
  matchCalendar,
  type MatchableCalendar,
} from "@/lib/assistant/calendar-match";

// Spec 036, T1: the calendar named in the chat (RF-18 to RF-23).

const cal = (
  name: string,
  over: Partial<MatchableCalendar> = {},
): MatchableCalendar => ({
  id: name,
  name,
  writable: true,
  reason: null,
  ...over,
});

const FAMILIA = cal("Familia");
const UNI = cal("Uni");
const GOOGLE = cal("alexponmon@gmail.com");
const TRABAJO = cal("Trabajo de Ana", { writable: false, reason: "viewer" });
const FESTIVOS = cal("Festivos en España", {
  writable: false,
  reason: "provider",
});
const ALL = [FAMILIA, UNI, GOOGLE, TRABAJO, FESTIVOS];

describe("matchCalendar", () => {
  it("finds a calendar ignoring case and accents", () => {
    expect(matchCalendar("familía", ALL)).toEqual({
      status: "ok",
      calendar: FAMILIA,
    });
  });

  it("finds the Google calendar named after its account e-mail", () => {
    expect(matchCalendar("alexponmon@gmail.com", ALL)).toEqual({
      status: "ok",
      calendar: GOOGLE,
    });
    expect(matchCalendar("el calendario de alexponmon", ALL)).toEqual({
      status: "ok",
      calendar: GOOGLE,
    });
  });

  it("accepts a part of the name and filler words", () => {
    expect(matchCalendar("el de la uni", ALL)).toEqual({
      status: "ok",
      calendar: UNI,
    });
  });

  it("prefers the exact name over a partial one", () => {
    const uniAna = cal("Uni de Ana");
    expect(matchCalendar("Uni", [UNI, uniAna])).toEqual({
      status: "ok",
      calendar: UNI,
    });
  });

  it("asks which one when several match (RF-22)", () => {
    const icloud = cal("Casa iCloud");
    const google = cal("Casa Google");
    expect(matchCalendar("casa", [icloud, google])).toEqual({
      status: "ambiguous",
      options: ["Casa Google", "Casa iCloud"],
    });
  });

  it("says why a read-only calendar cannot be used (RF-23)", () => {
    expect(matchCalendar("trabajo de ana", ALL)).toEqual({
      status: "read_only",
      name: "Trabajo de Ana",
      reason: "viewer",
      options: ["alexponmon@gmail.com", "Familia", "Uni"],
    });
    expect(matchCalendar("festivos", ALL)).toMatchObject({
      status: "read_only",
      reason: "provider",
    });
  });

  it("offers the writable ones when nothing matches (RF-23)", () => {
    expect(matchCalendar("gimnasio", ALL)).toEqual({
      status: "not_found",
      name: "gimnasio",
      options: ["alexponmon@gmail.com", "Familia", "Uni"],
    });
  });

  it("uses the only writable calendar when none is named (RF-20)", () => {
    expect(matchCalendar(null, [FAMILIA, TRABAJO])).toEqual({
      status: "ok",
      calendar: FAMILIA,
    });
  });

  it("asks which calendar when none is named and there are several (RF-21)", () => {
    expect(matchCalendar("  ", ALL)).toEqual({
      status: "need_calendar",
      options: ["alexponmon@gmail.com", "Familia", "Uni"],
    });
  });

  it("says when no calendar can be written", () => {
    expect(matchCalendar("Familia", [TRABAJO, FESTIVOS])).toEqual({
      status: "no_writable",
    });
  });
});
