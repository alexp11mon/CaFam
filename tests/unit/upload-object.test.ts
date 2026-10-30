import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadObject } from "@/lib/images/upload-object";

// Spec 012, T7: uploading straight to Storage with progress and cancel (plan
// D1; RF-6, RF-24). XMLHttpRequest is replaced by a fake one.
class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = "";
  upload: { onprogress?: (e: { loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  aborted = false;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, text = "") {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

const blob = new Blob(["jpeg"], { type: "image/jpeg" });

function start(signal?: AbortSignal, onProgress = vi.fn()) {
  const promise = uploadObject({
    path: "abc/full.jpg",
    blob,
    accessToken: "token",
    onProgress,
    signal,
  });
  return { promise, xhr: FakeXhr.last, onProgress };
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadObject", () => {
  it("posts the blob to the bucket with the session and no upsert", async () => {
    const { promise, xhr } = start();
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toMatch(
      /\/storage\/v1\/object\/event-images\/abc\/full\.jpg$/,
    );
    expect(xhr.headers).toMatchObject({
      Authorization: "Bearer token",
      "x-upsert": "false",
      "Content-Type": "image/jpeg",
    });
    expect(xhr.headers).toHaveProperty("apikey");
    expect(xhr.body).toBe(blob);
    xhr.respond(200);
    expect(await promise).toBe("ok");
  });

  it("reports the progress of the upload", async () => {
    const { promise, xhr, onProgress } = start();
    xhr.upload.onprogress?.({ loaded: 50, total: 200 });
    expect(onProgress).toHaveBeenCalledWith(50, 200);
    xhr.respond(200);
    await promise;
  });

  it("counts an object that already exists as uploaded, for Reintentar", async () => {
    const first = start();
    first.xhr.respond(409);
    expect(await first.promise).toBe("ok");
    const second = start();
    second.xhr.respond(400, '{"statusCode":"409","error":"Duplicate"}');
    expect(await second.promise).toBe("ok");
  });

  it("tells network errors, refusals and cancels apart", async () => {
    const network = start();
    network.xhr.onerror?.();
    expect(await network.promise).toBe("network");

    const refused = start();
    refused.xhr.respond(403, '{"statusCode":"403"}');
    expect(await refused.promise).toBe("rejected");

    const controller = new AbortController();
    const cancelled = start(controller.signal);
    controller.abort();
    expect(cancelled.xhr.aborted).toBe(true);
    expect(await cancelled.promise).toBe("aborted");
  });

  it("does not start when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await start(controller.signal).promise).toBe("aborted");
  });
});
