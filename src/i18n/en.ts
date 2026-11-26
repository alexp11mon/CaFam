import type { Messages } from "@/lib/i18n/translate";
import { assistant } from "./en/assistant";
import { common } from "./en/common";
import { settings } from "./en/settings";
import { trash } from "./en/trash";

// Spec 053 plan D7: one English catalog, keyed by the Spanish text. Only
// English accounts receive it; Spanish never ships it.
export const EN: Messages = {
  ...common,
  ...assistant,
  ...settings,
  ...trash,
};
