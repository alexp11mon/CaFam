import {
  createCipheriv,
  createECDH,
  createHmac,
  randomBytes,
} from "node:crypto";

// Web Push message encryption, aes128gcm (RFC 8291 over RFC 8188), with
// node:crypto only (spec 040 RF-17, RNF-1, plan D1). Server only.

const RECORD_SIZE = 4096;

const hmac = (key: Buffer, data: Buffer) =>
  createHmac("sha256", key).update(data).digest();

/**
 * The body of a push message for a subscription (`p256dh` and `auth` in
 * base64url, as the browser gives them). `options` fixes the salt and the
 * server key, only for the RFC test vector.
 */
export function encryptPayload(
  payload: Buffer,
  p256dh: string,
  auth: string,
  options: { salt?: Buffer; serverPrivateKey?: Buffer } = {},
): Buffer {
  const uaPublic = Buffer.from(p256dh, "base64url");
  const authSecret = Buffer.from(auth, "base64url");
  const salt = options.salt ?? randomBytes(16);
  const server = createECDH("prime256v1");
  if (options.serverPrivateKey) server.setPrivateKey(options.serverPrivateKey);
  else server.generateKeys();
  const asPublic = server.getPublicKey();
  const secret = server.computeSecret(uaPublic);

  // RFC 8291 section 3.4: one-step HKDF expansions (32 bytes or less).
  const ikm = hmac(
    hmac(authSecret, secret),
    Buffer.concat([
      Buffer.from("WebPush: info\0"),
      uaPublic,
      asPublic,
      Buffer.from([1]),
    ]),
  );
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01"));
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01"));

  // One record: the content and the last-record delimiter 0x02 (RFC 8188).
  const cipher = createCipheriv(
    "aes-128-gcm",
    cek.subarray(0, 16),
    nonce.subarray(0, 12),
  );
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}
