"use server";

import { z } from "zod";
import {
  CONVERSATION_TEXTS,
  conversationTitle,
  fromSaved,
  savedMessagesSchema,
  type SavedMessage,
} from "@/lib/assistant/conversations";
import { requireActionUser } from "@/lib/calendar/queries";
import type { Json } from "@/types/database";

// Spec 052 RF-9 to RF-12 (plan D3): Venito's saved conversations. Only with
// "Guardar conversaciones" on; RLS keeps each one to its author.

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
}

export type ConversationResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();

/** RF-9: whether this user keeps conversations. */
async function saving(
  supabase: Awaited<ReturnType<typeof requireActionUser>>["supabase"],
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("save_chats")
    .eq("id", userId)
    .maybeSingle();
  return data?.save_chats === true;
}

/** RF-9: turns saving on or off; off may also forget what was saved (RF-12). */
export async function setSaveChats(
  on: boolean,
  forget = false,
): Promise<ConversationResult> {
  const { supabase, userId } = await requireActionUser();
  const { error } = await supabase
    .from("profiles")
    .update({ save_chats: on === true })
    .eq("id", userId);
  if (error) return { ok: false, error: CONVERSATION_TEXTS.failed };
  if (!on && forget === true) return deleteConversations();
  return { ok: true };
}

/** RF-9: saved after each answer, under the id the chat gave it. */
export async function saveConversation(
  id: string,
  messages: unknown,
): Promise<ConversationResult> {
  const key = idSchema.safeParse(id);
  const parsed = savedMessagesSchema.safeParse(messages);
  if (!key.success || !parsed.success) {
    return { ok: false, error: CONVERSATION_TEXTS.failed };
  }
  const { supabase, userId } = await requireActionUser();
  if (!(await saving(supabase, userId))) return { ok: true };
  const { error } = await supabase.from("assistant_conversations").upsert({
    id: key.data,
    user_id: userId,
    title: conversationTitle(parsed.data),
    messages: parsed.data as Json,
  });
  return error ? { ok: false, error: CONVERSATION_TEXTS.failed } : { ok: true };
}

/** RF-10: the saved ones, newest first. */
export async function listConversations(): Promise<ConversationItem[]> {
  const { supabase } = await requireActionUser();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}

/** RF-10, RF-11: one of them to go on with; waiting cards come back expired. */
export async function loadConversation(
  id: string,
): Promise<
  { ok: true; messages: SavedMessage[] } | { ok: false; error: string }
> {
  const key = idSchema.safeParse(id);
  if (!key.success) return { ok: false, error: CONVERSATION_TEXTS.gone };
  const { supabase } = await requireActionUser();
  const { data } = await supabase
    .from("assistant_conversations")
    .select("messages")
    .eq("id", key.data)
    .maybeSingle();
  const parsed = savedMessagesSchema.safeParse(data?.messages);
  return parsed.success
    ? { ok: true, messages: fromSaved(parsed.data) }
    : { ok: false, error: CONVERSATION_TEXTS.gone };
}

/** RF-10: forgets one. */
export async function deleteConversation(
  id: string,
): Promise<ConversationResult> {
  const key = idSchema.safeParse(id);
  if (!key.success) return { ok: false, error: CONVERSATION_TEXTS.gone };
  const { supabase } = await requireActionUser();
  const { error } = await supabase
    .from("assistant_conversations")
    .delete()
    .eq("id", key.data);
  return error ? { ok: false, error: CONVERSATION_TEXTS.failed } : { ok: true };
}

/** RF-10, RF-12: forgets them all. */
export async function deleteConversations(): Promise<ConversationResult> {
  const { supabase, userId } = await requireActionUser();
  const { error } = await supabase
    .from("assistant_conversations")
    .delete()
    .eq("user_id", userId);
  return error ? { ok: false, error: CONVERSATION_TEXTS.failed } : { ok: true };
}
