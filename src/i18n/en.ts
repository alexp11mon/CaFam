import type { Messages } from "@/lib/i18n/translate";
import { settings } from "./en/settings";

// Spec 053 plan D7: one English catalog, keyed by the Spanish text. Only
// English accounts receive it; Spanish never ships it.
export const EN: Messages = {
  ...settings,
};
