import { describe, expect, it } from "vitest";
import { getMergeAccess, type MergeMember } from "@/lib/sharing/merge-access";

const A = "calendar-a";
const B = "calendar-b";
const C = "calendar-c";

function member(
  calendarId: string,
  userId: string,
  name: string,
  role: MergeMember["role"] = "viewer",
): MergeMember {
  return { calendarId, userId, name, role };
}

const OWNER_A = member(A, "owner", "Propietaria", "owner");
const OWNER_B = member(B, "owner", "Propietaria", "owner");

describe("getMergeAccess (RF-36, RF-37)", () => {
  it("returns empty lists when nobody else is a member", () => {
    expect(
      getMergeAccess({
        sourceIds: [A, B],
        targetId: A,
        members: [OWNER_A, OWNER_B],
      }),
    ).toEqual({ losing: [], gaining: [] });
    expect(
      getMergeAccess({ sourceIds: [A, B], targetId: A, members: [] }),
    ).toEqual({ losing: [], gaining: [] });
  });

  it("loses access: members of a vanishing calendar who are not in the target", () => {
    const result = getMergeAccess({
      sourceIds: [A, B],
      targetId: A,
      members: [OWNER_A, OWNER_B, member(B, "ana", "Ana")],
    });
    expect(result.losing).toEqual(["Ana"]);
  });

  it("keeps access for members of a vanishing calendar who are also in the target", () => {
    const result = getMergeAccess({
      sourceIds: [A, B],
      targetId: A,
      members: [
        OWNER_A,
        OWNER_B,
        member(A, "ana", "Ana"),
        member(B, "ana", "Ana"),
      ],
    });
    expect(result.losing).toEqual([]);
  });

  it("gains visibility: members of the existing target", () => {
    const result = getMergeAccess({
      sourceIds: [A, B],
      targetId: A,
      members: [OWNER_A, OWNER_B, member(A, "luis", "Luis", "editor")],
    });
    expect(result.gaining).toEqual(["Luis"]);
  });

  it("never lists the owner", () => {
    const result = getMergeAccess({
      sourceIds: [A, B, C],
      targetId: A,
      members: [OWNER_A, OWNER_B, member(C, "ana", "Ana")],
    });
    expect(result.losing).toEqual(["Ana"]);
    expect(result.gaining).toEqual([]);
  });

  it("with a new target nobody gains and every member of the sources loses access", () => {
    const result = getMergeAccess({
      sourceIds: [A, B],
      targetId: null,
      members: [
        OWNER_A,
        OWNER_B,
        member(A, "luis", "Luis"),
        member(B, "ana", "Ana"),
      ],
    });
    expect(result.gaining).toEqual([]);
    expect(result.losing).toEqual(["Ana", "Luis"]);
  });

  it("lists each person once, sorted by name", () => {
    const result = getMergeAccess({
      sourceIds: [A, B, C],
      targetId: A,
      members: [
        member(B, "zoe", "Zoe"),
        member(C, "zoe", "Zoe"),
        member(B, "ana", "Ana"),
      ],
    });
    expect(result.losing).toEqual(["Ana", "Zoe"]);
  });

  it("ignores members of calendars that are not part of the merge", () => {
    const result = getMergeAccess({
      sourceIds: [A, B],
      targetId: A,
      members: [member("other", "ana", "Ana")],
    });
    expect(result).toEqual({ losing: [], gaining: [] });
  });
});
