import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { CalendarList } from "@/components/dashboard/calendar-list";
import { AssignGroupSelect } from "@/components/groups/assign-group-select";
import { FoldSection } from "@/components/groups/fold-section";
import { GroupForm } from "@/components/groups/group-form";
import { NewGroupButton } from "@/components/groups/new-group-button";
import { GroupSection } from "@/components/groups/group-section";
import { ToastProvider } from "@/components/ui/toast";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 007, T13: groups in "Mis calendarios" and in the filters (RF-35 to RF-41, RF-46).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/calendar",
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const GROUP = { id: "g1", name: "Trabajo" };

// Rename, delete and move wait behind "⋯" (spec 032 RF-11).
async function options() {
  await userEvent.click(
    screen.getByRole("button", { name: "Opciones de Trabajo" }),
  );
}

function section(
  overrides: Partial<React.ComponentProps<typeof GroupSection>> = {},
) {
  const props = {
    group: GROUP,
    visibility: "shown" as const,
    calendarCount: 2,
    index: 0,
    count: 2,
    setVisibility: vi.fn(async () => ({})),
    renameAction: vi.fn(async () => ({ values: { name: "Trabajo" } })),
    deleteAction: vi.fn(async () => ({})),
    onMove: vi.fn(),
    ...overrides,
  };
  render(
    <GroupSection {...props}>
      <p>Contenido del grupo</p>
    </GroupSection>,
  );
  return props;
}

describe("GroupSection", () => {
  it("shows the name, its calendars and a visibility switch (RF-36, RF-39)", async () => {
    const user = userEvent.setup();
    const props = section();

    expect(
      screen.getByRole("heading", { name: "Trabajo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Contenido del grupo")).toBeInTheDocument();
    const toggle = screen.getByRole("checkbox", {
      name: /mostrar «trabajo» en el calendario/i,
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(props.setVisibility).toHaveBeenCalledWith(false);
  });

  it("announces a partly visible group and shows it all when switched (RF-40)", async () => {
    const user = userEvent.setup();
    const props = section({ visibility: "partial" });

    const toggle = screen.getByRole("checkbox", { name: /mostrar/i });
    expect((toggle as HTMLInputElement).indeterminate).toBe(true);
    expect(toggle).toHaveAccessibleDescription(/parcialmente visible/i);

    await user.click(toggle);

    expect(props.setVisibility).toHaveBeenCalledWith(true);
  });

  it("renames with the keyboard (RF-41)", async () => {
    const user = userEvent.setup();
    const props = section();
    await options();

    await user.click(screen.getByRole("button", { name: "Renombrar Trabajo" }));
    const field = screen.getByLabelText(/nuevo nombre/i);
    await user.clear(field);
    await user.type(field, "Oficina{Enter}");

    const rename = props.renameAction as ReturnType<typeof vi.fn>;
    const data = (rename.mock.calls[0] as unknown[])[1] as FormData;
    expect(data.get("name")).toBe("Oficina");
  });

  it("asks before deleting and says the calendars stay (RF-41)", async () => {
    const user = userEvent.setup();
    const props = section();
    await options();

    await user.click(screen.getByRole("button", { name: "Borrar Trabajo" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/no se borra ningún calendario/i);
    await user.click(
      within(dialog).getByRole("button", { name: "Sí, borrar" }),
    );

    expect(props.deleteAction).toHaveBeenCalled();
  });

  it("moves the group up and down, never past the ends (RF-38)", async () => {
    const user = userEvent.setup();
    const props = section({ index: 0, count: 2 });
    await options();

    expect(
      screen.getByRole("button", { name: "Subir Trabajo" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Bajar Trabajo" }));

    expect(props.onMove).toHaveBeenCalledWith("down");
  });
});

describe("GroupForm (RF-35)", () => {
  it("creates a group and shows the error next to the field", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      fieldErrors: { name: "Ya tienes un grupo con ese nombre." },
      values: { name: "Trabajo" },
    }));
    render(<GroupForm action={action} />);

    await user.type(screen.getByLabelText("Nombre del grupo"), "Trabajo");
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));

    expect(
      await screen.findByText("Ya tienes un grupo con ese nombre."),
    ).toBeInTheDocument();
    const data = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(data.get("name")).toBe("Trabajo");
  });
});

describe("AssignGroupSelect (RF-36, RF-37)", () => {
  const groups = [
    { id: "g1", name: "Trabajo" },
    { id: "g2", name: "Ocio" },
  ];

  it("moves a calendar to a group or out of it", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({}));
    render(
      <AssignGroupSelect
        calendarName="Fútbol"
        groupId="g1"
        groups={groups}
        action={action}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Grupo de Fútbol" });
    expect(select).toHaveValue("g1");
    await user.selectOptions(select, "g2");
    await user.selectOptions(select, "");

    expect(action.mock.calls).toEqual([["g2"], [null]]);
  });

  it("shows the error when the move fails", async () => {
    const user = userEvent.setup();
    render(
      <AssignGroupSelect
        calendarName="Fútbol"
        groupId={null}
        groups={groups}
        action={async () => ({ error: "Ese grupo ya no existe." })}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox"), "g1");

    expect(
      await screen.findByText("Ese grupo ya no existe."),
    ).toBeInTheDocument();
  });
});

describe("CalendarList with groups (RF-36, RF-46)", () => {
  it("offers a group for each calendar and labels the ones without owner", async () => {
    render(
      <CalendarList
        timeZone="Europe/Madrid"
        leaveAction={vi.fn()}
        groups={[{ id: "g1", name: "Trabajo" }]}
        assignAction={vi.fn()}
        calendars={[
          {
            id: "c1",
            name: "Familia",
            color: "#A0C4FF",
            role: "editor",
            synced: null,
            orphan: true,
            groupId: "g1",
          },
        ]}
      />,
    );

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Sin propietario");
    await userEvent.click(
      within(item).getByRole("button", { name: /Familia/ }),
    );
    expect(
      within(item).getByRole("combobox", { name: "Grupo de Familia" }),
    ).toHaveValue("g1");
  });
});

describe("calendar filters with groups (RF-36, RF-38 to RF-40)", () => {
  const cal = (id: string, visible: boolean) => ({
    id,
    name: `Cal ${id}`,
    ownerId: "me",
    createdAt: "2026-01-01T00:00:00Z",
    color: "#A0C4FF",
    visible,
  });

  function setupWorkspace() {
    const props = {
      setCalendarVisibility: vi.fn(async () => ({})),
      setPersonVisibility: vi.fn(async () => ({})),
      setGroupVisibility: vi.fn(async () => ({})),
      saveOrder: vi.fn(async () => ({})),
    };
    render(
      <ToastProvider>
        <CalendarWorkspace
          view="month"
          date="2026-11-02"
          days={getVisibleRange("month", "2026-11-02", "Europe/Madrid").days}
          today="2026-10-21"
          timeZone="Europe/Madrid"
          events={[]}
          categories={[]}
          groups={[
            {
              person: { id: "g1", displayName: "Trabajo", isMe: false },
              groupId: "g1",
              calendars: [cal("a", true), cal("b", false)],
            },
            {
              person: { id: "g2", displayName: "Ocio", isMe: false },
              groupId: "g2",
              calendars: [cal("c", true)],
            },
            {
              person: { id: "me", displayName: "Yo", isMe: true },
              calendars: [cal("d", true)],
            },
          ]}
          {...props}
        />
      </ToastProvider>,
    );
    return props;
  }

  it("shows a partly visible group and shows it all through the group action", async () => {
    const user = userEvent.setup();
    const props = setupWorkspace();

    const toggle = screen.getByRole("checkbox", { name: "Trabajo" });
    expect((toggle as HTMLInputElement).indeterminate).toBe(true);
    await user.click(toggle);

    expect(props.setGroupVisibility).toHaveBeenCalledWith("g1", true);
    expect(props.setPersonVisibility).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Cal b" })).toBeChecked();
  });

  it("moves groups among groups and people among people", async () => {
    const user = userEvent.setup();
    const props = setupWorkspace();
    // The up/down buttons are in "Ordenar" (spec 032 RF-7).
    await user.click(screen.getByRole("button", { name: "Ordenar" }));

    expect(screen.getByRole("button", { name: "Bajar Ocio" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir Yo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Bajar Trabajo" }));

    expect(props.saveOrder).toHaveBeenCalledWith({
      people: ["me"],
      groups: ["g2", "g1"],
      calendars: { g2: ["c"], g1: ["a", "b"], me: ["d"] },
    });
  });
});

describe("lighter Mis calendarios (spec 032 RF-10, RF-11, RF-13)", () => {
  it("folds a group with the same memory as the filters", async () => {
    const user = userEvent.setup();
    section({ calendarCount: 2 });
    expect(screen.getByText("2 calendarios")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plegar Trabajo" }));

    expect(screen.queryByText("Contenido del grupo")).not.toBeVisible();
    expect(JSON.parse(localStorage.getItem("cafam-folded")!)).toEqual({
      "group:g1": true,
    });
  });

  it("keeps the group's actions behind Opciones", async () => {
    const user = userEvent.setup();
    section();
    expect(
      screen.queryByRole("button", { name: "Renombrar Trabajo" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Opciones de Trabajo" }),
    );

    expect(
      screen.getByRole("button", { name: "Opciones de Trabajo" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Renombrar Trabajo" }),
    ).toBeInTheDocument();
  });

  it("folds Sin grupo too", async () => {
    const user = userEvent.setup();
    render(
      <FoldSection id="section:ungrouped" title="Sin grupo" count={1}>
        <p>Calendarios sueltos</p>
      </FoldSection>,
    );
    expect(screen.getByText("1 calendario")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plegar Sin grupo" }));

    expect(screen.getByText("Calendarios sueltos")).not.toBeVisible();
  });

  it("creates a group from a sheet that closes when it is created", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ values: { name: "" } }));
    render(<NewGroupButton action={action} />);

    await user.click(screen.getByRole("button", { name: "Nuevo grupo" }));
    const sheet = screen.getByRole("dialog", { name: "Nuevo grupo" });
    await user.type(
      within(sheet).getByLabelText("Nombre del grupo"),
      "Familia",
    );
    await user.click(
      within(sheet).getByRole("button", { name: "Crear grupo" }),
    );

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const data = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(data.get("name")).toBe("Familia");
  });
});
