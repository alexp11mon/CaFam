"use client";

import { useState } from "react";
import {
  deleteConversation,
  deleteConversations,
  listConversations,
  setSaveChats,
  type ConversationItem,
} from "@/app/dashboard/assistant/conversation-actions";
import { MoreIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { CONVERSATION_TEXTS } from "@/lib/assistant/conversations";
import { ConversationList } from "./conversation-list";
import { useT } from "@/components/i18n/locale-provider";

// Spec 052 RF-9 to RF-12, RF-14: the "⋯" of the chat. Saving conversations
// and reading answers aloud are both off by default.

export function ChatMenu({
  saveChats,
  onSaveChatsChange,
  onOpenConversation,
  speak,
}: {
  saveChats: boolean;
  onSaveChatsChange: (on: boolean) => void;
  onOpenConversation: (id: string) => Promise<boolean>;
  /** RF-14: only where the browser can speak. */
  speak?: { on: boolean; onChange: (on: boolean) => void };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  // RF-12: turning it off asks whether to forget what was saved.
  const [asking, setAsking] = useState(false);
  const toast = useToast();

  async function reload() {
    setItems(await listConversations().catch(() => []));
  }

  async function change(on: boolean) {
    if (!on && items?.length) {
      setAsking(true);
      return;
    }
    await save(on, false);
  }

  async function save(on: boolean, forget: boolean) {
    setAsking(false);
    onSaveChatsChange(on);
    const result = await setSaveChats(on, forget).catch(() => null);
    if (!result?.ok) {
      onSaveChatsChange(!on);
      toast.show(CONVERSATION_TEXTS.failed);
      return;
    }
    if (forget) setItems([]);
  }

  async function remove(id: string | null) {
    const result = await (
      id ? deleteConversation(id) : deleteConversations()
    ).catch(() => null);
    if (!result?.ok) {
      toast.show(CONVERSATION_TEXTS.failed);
      return;
    }
    setItems((current) =>
      id ? (current ?? []).filter((item) => item.id !== id) : [],
    );
  }

  return (
    <>
      <IconButton
        label={t("Más opciones del chat")}
        onClick={() => {
          setOpen(true);
          void reload();
        }}
      >
        <MoreIcon />
      </IconButton>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setAsking(false);
        }}
        title={t("Opciones del chat")}
      >
        <div className="flex flex-col gap-5 pt-1">
          <Switch
            label={t("Guardar conversaciones")}
            description={t(
              "Se guardan las 50 últimas durante 90 días y solo las ves tú. Las imágenes no se guardan.",
            )}
            checked={saveChats}
            onCheckedChange={change}
          />
          {asking ? (
            <div className="flex flex-col gap-2 rounded-control border border-line p-3">
              <p className="text-sm">
                {t(
                  "¿Borrar también las conversaciones que ya están guardadas?",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" onClick={() => void save(false, true)}>
                  {t("Borrarlas")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void save(false, false)}
                >
                  {t("Conservarlas")}
                </Button>
              </div>
            </div>
          ) : null}
          {speak ? (
            <Switch
              label={t("Leer respuestas en voz alta")}
              description={t(
                "Solo en este dispositivo. Lee el texto de Venito, no las tarjetas.",
              )}
              checked={speak.on}
              onCheckedChange={speak.onChange}
            />
          ) : null}
          <ConversationList
            items={items}
            onOpen={async (id) => {
              if (await onOpenConversation(id)) setOpen(false);
            }}
            onDelete={(id) => void remove(id)}
            onDeleteAll={() => void remove(null)}
          />
        </div>
      </Sheet>
    </>
  );
}
