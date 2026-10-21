import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/lib/ics/ip-guard";

describe("isPublicAddress (RF-4, plan R1)", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "169.254.0.1",
    "100.64.0.1", // CGNAT
    "100.127.255.255",
    "0.0.0.0",
    "0.1.2.3",
    "224.0.0.1",
    "239.255.255.255",
    "255.255.255.255",
    "192.0.2.1",
  ])("rejects the private or reserved IPv4 %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each([
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "febf::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1", // the same loopback in hexadecimal form
    "::ffff:169.254.169.254",
    "64:ff9b::a00:1", // NAT64 of 10.0.0.1
    "2002:a00:1::", // 6to4 of 10.0.0.1
    "[::1]",
    "fe80::1%eth0",
  ])("rejects the private or reserved IPv6 %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "142.250.185.14",
    "172.15.0.1",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "169.253.0.1",
    "192.169.0.1",
    "2606:4700:4700::1111",
    "2a00:1450:4003:80f::200e",
    "::ffff:8.8.8.8",
  ])("accepts the public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each(["", "localhost", "example.com", "999.1.1.1", "1.2.3", "::g"])(
    "rejects what is not an IP address: %j",
    (value) => {
      expect(isPublicAddress(value)).toBe(false);
    },
  );
});
