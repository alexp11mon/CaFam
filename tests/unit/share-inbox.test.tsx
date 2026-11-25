import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareInbox } from "@/components/share/share-inbox";
import { PENDING_IMAGES_KEY, readShared } from "@/lib/share/inbox";
import { memoryIndexedDb } from "./memory-indexeddb";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const ID = "00000000-0000-4000-8000-000000000001";
let idb: ReturnType<typeof memoryIndexedDb>;

function seed(item: { text?: string; files?: File[]; createdAt?: number }) {
  idb.versions.set("cafam-share", 1);
  idb.databases.set(
    "cafam-share",
    new Map([
      [
        "items",
        new Map([
          [
            ID,
            {
              id: ID,
              createdAt: item.createdAt ?? Date.now(),
              text: item.text ?? "",
              files: item.files ?? [],
            },
          ],
        ]),
      ],
    ]),
  );
}

beforeEach(() => {
  idb = memoryIndexedDb();
  vi.stubGlobal("indexedDB", idb);
  router.replace.mockClear();
  router.push.mockClear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const image = (n: number) =>
  new File(["x"], `foto${n}.jpg`, { type: "image/jpeg" });

describe("ShareInbox (spec 047 RF-6 to RF-8)", () => {
  it("takes an .ics to the import, which reads it from the device", async () => {
    seed({
      files: [new File(["BEGIN"], "cena.ics", { type: "text/calendar" })],
    });
    render(<ShareInbox id={ID} />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        `/dashboard/import?shared=${ID}`,
      ),
    );
  });

  it("takes text to the new event phrase and forgets it", async () => {
    seed({ text: "Cena con Ana el viernes a las 21" });
    render(<ShareInbox id={ID} />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/dashboard/events/new?text=Cena%20con%20Ana%20el%20viernes%20a%20las%2021",
      ),
    );
    expect(await readShared(ID)).toBeNull();
  });

  it("asks what to do with images: Venito", async () => {
    seed({ files: [image(1), image(2)] });
    render(<ShareInbox id={ID} />);
    expect(
      await screen.findByRole("heading", {
        name: "¿Qué hago con estas imágenes?",
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Preguntar a Venito" }),
    );
    expect(router.replace).toHaveBeenCalledWith(
      `/dashboard/assistant?shared=${ID}`,
    );
  });

  it("asks what to do with an image: add it to an event found by search", async () => {
    seed({ files: [image(1)] });
    render(<ShareInbox id={ID} />);
    await screen.findByRole("heading", { name: "¿Qué hago con esta imagen?" });
    await userEvent.click(
      screen.getByRole("button", { name: "Añadir a un evento" }),
    );
    expect(sessionStorage.getItem(PENDING_IMAGES_KEY)).toBe(ID);
    expect(router.push).toHaveBeenCalledWith("/dashboard/search");
  });

  it("says when it is gone or too old", async () => {
    seed({ text: "x", createdAt: Date.now() - 11 * 60 * 1000 });
    render(<ShareInbox id={ID} />);
    expect(
      await screen.findByText("Lo compartido ya no está"),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("says when nothing can be used", async () => {
    seed({ files: [new File(["%PDF"], "a.pdf", { type: "application/pdf" })] });
    render(<ShareInbox id={ID} />);
    expect(
      await screen.findByText("No sabemos qué hacer con esto"),
    ).toBeInTheDocument();
  });
});
