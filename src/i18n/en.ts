import type { Messages } from "@/lib/i18n/translate";
import { account } from "./en/account";
import { assistant } from "./en/assistant";
import { auth } from "./en/auth";
import { calendar } from "./en/calendar";
import { common } from "./en/common";
import { connections } from "./en/connections";
import { limits } from "./en/limits";
import { lists } from "./en/lists";
import { modules } from "./en/modules";
import { notes } from "./en/notes";
import { now } from "./en/now";
import { pages } from "./en/pages";
import { privacy } from "./en/privacy";
import { settings } from "./en/settings";
import { sharing } from "./en/sharing";
import { trash } from "./en/trash";
import { values } from "./en/values";

// Spec 053 plan D7: one English catalog, keyed by the Spanish text. Only
// English accounts receive it; Spanish never ships it.
export const EN: Messages = {
  ...common,
  ...account,
  ...assistant,
  ...auth,
  ...calendar,
  ...connections,
  ...limits,
  ...lists,
  ...modules,
  ...values,
  ...notes,
  ...now,
  ...pages,
  ...privacy,
  ...settings,
  ...sharing,
  ...trash,
};
