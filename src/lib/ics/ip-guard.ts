import { isIP } from "node:net";

type V4 = [number, number, number, number];

function parseV4(address: string): V4 | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : NaN,
  );
  return numbers.every((n) => n >= 0 && n <= 255) ? (numbers as V4) : null;
}

/** Reserved IPv4 ranges that must never be reached from the server (plan R1). */
function isPublicV4([a, b, c]: V4): boolean {
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast and reserved
  return true;
}

/** Expands an IPv6 address to its eight 16-bit groups, or null if it is malformed. */
function parseV6(address: string): number[] | null {
  let text = address;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseV4(tail);
    if (!v4) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${(
      (v4[2] << 8) |
      v4[3]
    ).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part ? part.split(":") : []);
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [
    ...head,
    ...Array<string>(halves.length === 2 ? missing : 0).fill("0"),
    ...rest,
  ];
  if (groups.length !== 8) return null;
  const numbers = groups.map((group) =>
    /^[0-9a-f]{1,4}$/i.test(group) ? parseInt(group, 16) : NaN,
  );
  return numbers.every((n) => Number.isInteger(n)) ? numbers : null;
}

function v4FromGroups(high: number, low: number): V4 {
  return [high >> 8, high & 255, low >> 8, low & 255];
}

function isPublicV6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if (groups.every((g) => g === 0)) return false; // ::
  if (groups.slice(0, 7).every((g) => g === 0) && g7 === 1) return false; // ::1
  // ::ffff:a.b.c.d (IPv4 mapped) and 64:ff9b::/96 (NAT64) carry an IPv4 address.
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0xffff
  ) {
    return isPublicV4(v4FromGroups(g6, g7));
  }
  if (
    g0 === 0x64 &&
    g1 === 0xff9b &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0
  ) {
    return isPublicV4(v4FromGroups(g6, g7));
  }
  if (g0 === 0x2002) return isPublicV4(v4FromGroups(g1, g2)); // 6to4
  if ((g0 & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false; // link local fe80::/10
  if ((g0 & 0xff00) === 0xff00) return false; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return false; // discard
  return true;
}

/**
 * Whether an IP address (v4 or v6, brackets and zone id tolerated) is a public
 * one. Anything that is not an IP address is rejected: this function never
 * resolves names (RF-4).
 */
export function isPublicAddress(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, "").split("%")[0];
  const version = isIP(address);
  if (version === 4) {
    const v4 = parseV4(address);
    return v4 !== null && isPublicV4(v4);
  }
  if (version === 6) {
    const v6 = parseV6(address);
    return v6 !== null && isPublicV6(v6);
  }
  return false;
}
