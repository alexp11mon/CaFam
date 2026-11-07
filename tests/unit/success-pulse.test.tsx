import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailForm } from "@/components/account/email-form";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { CommentForm } from "@/components/comments/comment-form";
import { SyncNowButton } from "@/components/connections/sync-now-button";
import { AvailabilitySetting } from "@/components/settings/availability-setting";
import { ViewOptionsSetting } from "@/components/settings/view-options-setting";
import { CopyButton } from "@/components/sharing/copy-button";
import { Switch } from "@/components/ui/switch";
import { pulse } from "@/lib/motion/play";

// Spec 021, T12: one pulse of the control that saved, only on success and
// always with the text that already says so (RF-47, RF-50, RF-51).
vi.mock("@/lib/motion/play", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/play")>()),
  pulse: vi.fn(),
}));

afterEach(() => {
  vi.mocked(pulse).mockClear();
  Reflect.deleteProperty(navigator, "clipboard");
});

const pulsed = () => vi.mocked(pulse).mock.calls.map(([el]) => el);

describe("success pulse (RF-47, RF-50, RF-51)", () => {
  it("pulses Guardar perfil once the profile is saved", async () => {
    const values = { displayName: "Ana", timeZone: "Europe/Madrid" };
    render(
      <ProfileForm
        action={async () => ({ values, saved: true })}
        initial={values}
        timeZones={["Europe/Madrid"]}
      />,
    );
    const button = screen.getByRole("button", { name: "Guardar perfil" });
    await userEvent.click(button);
    expect(await screen.findByText("Perfil guardado.")).toBeVisible();
    expect(pulsed()).toEqual([button]);
  });

  it("does not pulse when the profile fails", async () => {
    const values = { displayName: "", timeZone: "Europe/Madrid" };
    render(
      <ProfileForm
        action={async () => ({ values, formError: "No se ha podido." })}
        initial={values}
        timeZones={["Europe/Madrid"]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar perfil" }),
    );
    await screen.findByText("No se ha podido.");
    expect(pulse).not.toHaveBeenCalled();
  });

  it("pulses Cambiar email when the change is asked", async () => {
    render(
      <EmailForm
        action={async () => ({
          values: { newEmail: "" },
          pendingEmail: "ana.nueva@example.com",
        })}
        email="ana@example.com"
        pendingEmail={null}
      />,
    );
    const button = screen.getByRole("button", { name: "Cambiar email" });
    await userEvent.click(button);
    await screen.findByText(/Cambio pendiente de confirmar/);
    expect(pulsed()).toEqual([button]);
  });

  it("pulses Cambiar contraseña once it is changed", async () => {
    render(<PasswordForm action={async () => ({ saved: true })} />);
    const button = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(button);
    await screen.findByText(/Contraseña cambiada/);
    expect(pulsed()).toEqual([button]);
  });

  it("pulses a switch that saved and says so", async () => {
    render(
      <ViewOptionsSetting
        showWeekends
        duration={60}
        saveWeekends={async () => ({})}
        saveDuration={async () => ({})}
      />,
    );
    const box = screen.getByRole("switch", { name: "Mostrar fines de semana" });
    await userEvent.click(box);
    expect(await screen.findByText("Guardado.")).toBeVisible();
    expect(pulsed()).toEqual([box]);
  });

  it("pulses the duration once saved", async () => {
    render(
      <ViewOptionsSetting
        showWeekends
        duration={60}
        saveWeekends={async () => ({})}
        saveDuration={async () => ({})}
      />,
    );
    const select = screen.getByLabelText("Duración de un evento nuevo");
    await userEvent.selectOptions(select, "30");
    expect(await screen.findByText("Guardado.")).toBeVisible();
    expect(pulsed()).toEqual([select]);
  });

  it("does not pulse a switch that failed", async () => {
    render(
      <AvailabilitySetting
        current={false}
        save={async () => ({ error: "No se ha podido guardar." })}
      />,
    );
    await userEvent.click(screen.getByRole("switch"));
    await screen.findByText("No se ha podido guardar.");
    expect(pulse).not.toHaveBeenCalled();
    expect(screen.queryByText("Guardado.")).toBeNull();
  });

  it("pulses the switch of a bare Switch only when the save resolves true", async () => {
    const onChange = vi.fn(async () => true);
    render(<Switch label="Algo" checked={false} onCheckedChange={onChange} />);
    const box = screen.getByRole("switch", { name: "Algo" });
    fireEvent.click(box);
    await waitFor(() => expect(pulsed()).toEqual([box]));
  });

  it("pulses Copiar enlace once copied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
      configurable: true,
    });
    render(<CopyButton text="https://example.com/invite/x" />);
    const button = screen.getByRole("button", { name: "Copiar enlace" });
    fireEvent.click(button);
    await screen.findByText("Enlace copiado.");
    expect(pulsed()).toEqual([button]);
  });

  it("does not pulse when the clipboard fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
    render(<CopyButton text="https://example.com/invite/x" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    await screen.findByText(/No se ha podido copiar/);
    expect(pulse).not.toHaveBeenCalled();
  });

  it("pulses Actualizar ahora after an update, not after the wait", async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce({ message: "Actualizado: nada.", updated: true })
      .mockResolvedValueOnce({ message: "Se ha actualizado hace poco." });
    render(<SyncNowButton action={action} />);
    const button = screen.getByRole("button", { name: "Actualizar ahora" });
    await userEvent.click(button);
    await screen.findByText("Actualizado: nada.");
    expect(pulsed()).toEqual([button]);
    await userEvent.click(button);
    await screen.findByText("Se ha actualizado hace poco.");
    expect(pulsed()).toEqual([button]);
  });

  it("pulses Comentar once the comment is sent, not when it fails", async () => {
    const onSend = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Sin conexión." })
      .mockResolvedValueOnce({ ok: true });
    render(<CommentForm onSend={onSend} />);
    const field = screen.getByLabelText("Escribe un comentario");
    const button = screen.getByRole("button", { name: "Comentar" });
    await userEvent.type(field, "Hola");
    await userEvent.click(button);
    await screen.findByText("Sin conexión.");
    expect(pulse).not.toHaveBeenCalled();
    await userEvent.click(button);
    await waitFor(() => expect(field).toHaveValue(""));
    expect(pulsed()).toEqual([button]);
  });
});
