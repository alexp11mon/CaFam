import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { EmailForm } from "@/components/account/email-form";
import { SignInMethods } from "@/components/account/sign-in-methods";
import { googleLoginEnabled } from "@/lib/auth/google-login";
import { signInMethods } from "@/lib/account/sign-in-methods";
import { createPassword, linkGoogle, unlinkGoogle } from "./identity-actions";
import { ExportData } from "@/components/account/export-data";
import { loadAccountExport, loadCalendarIcs } from "./export-actions";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { AccentPicker } from "@/components/settings/accent-picker";
import { AvailabilitySetting } from "@/components/settings/availability-setting";
import { BusySetting } from "@/components/settings/busy-setting";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { ThemePicker } from "@/components/settings/theme-picker";
import { LocalePicker } from "@/components/settings/locale-picker";
import { FormAlert } from "@/components/ui/form-alert";
import { getConfirmNotice } from "@/lib/account/confirm-type";
import { getAccountEmails, getProfile } from "@/lib/account/queries";
import {
  getAppearance,
  getViewOptions,
  requireUser,
} from "@/lib/calendar/queries";
import { ViewOptionsSetting } from "@/components/settings/view-options-setting";
import {
  setAccent,
  setDefaultDuration,
  setShareAvailability,
  setShareBusy,
  setBadgeToday,
  setShowWeekends,
  setLocale,
  setTheme,
} from "./actions";
import {
  changePassword,
  deleteAccount,
  requestEmailChange,
  saveProfile,
} from "./account-actions";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  setDefaultReminders,
  setNotificationPrefs,
} from "./push-actions";

export const metadata: Metadata = { title: "Ajustes" };

type SearchParams = Promise<{ confirm?: string }>;

// Each section reads the session, so it streams behind <Suspense> (cacheComponents).
async function AppearanceSection() {
  const { supabase, userId } = await requireUser();
  const { accent, theme, locale } = await getAppearance(supabase, userId);
  return (
    <>
      <LocalePicker current={locale} setLocale={setLocale} />
      <ThemePicker current={theme} setTheme={setTheme} />
      <AccentPicker current={accent} setAccent={setAccent} />
    </>
  );
}

async function ProfileSection() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId);
  return (
    <ProfileForm
      action={saveProfile}
      initial={profile}
      timeZones={Intl.supportedValuesOf("timeZone")}
    />
  );
}

async function AssistantSection() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("share_availability")
    .eq("id", userId)
    .maybeSingle();
  return (
    <AvailabilitySetting
      current={data?.share_availability ?? false}
      save={setShareAvailability}
    />
  );
}

async function BusySection() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("share_busy")
    .eq("id", userId)
    .maybeSingle();
  return (
    <BusySetting current={data?.share_busy ?? false} save={setShareBusy} />
  );
}

async function CalendarSection() {
  const { supabase, userId } = await requireUser();
  const { showWeekends, duration, badge } = await getViewOptions(
    supabase,
    userId,
  );
  return (
    <ViewOptionsSetting
      showWeekends={showWeekends}
      duration={duration}
      saveWeekends={setShowWeekends}
      saveDuration={setDefaultDuration}
      badge={badge}
      saveBadge={setBadgeToday}
    />
  );
}

// Spec 040: devices, default reminders and kinds of notice (RF-1 to RF-6, RF-14).
async function NotificationSection() {
  const { supabase, userId } = await requireUser();
  const [{ data: devices }, { data: profile }] = await Promise.all([
    supabase
      .from("push_subscriptions")
      .select("id, device, endpoint")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("notify, reminder_minutes, reminder_all_day_minutes")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const notify = (profile?.notify ?? {}) as Record<string, unknown>;
  return (
    <NotificationSettings
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      devices={devices ?? []}
      defaults={{
        timed: profile ? profile.reminder_minutes : 10,
        allDay: profile ? profile.reminder_all_day_minutes : 1440,
      }}
      notify={{
        joined: notify.joined !== false,
        access: notify.access !== false,
        comments: notify.comments !== false,
        changes: notify.changes === true,
      }}
      actions={{
        save: savePushSubscription,
        remove: removePushSubscription,
        test: sendTestPush,
        setNotify: setNotificationPrefs,
        setDefaults: setDefaultReminders,
      }}
    />
  );
}

async function EmailSection() {
  const { supabase } = await requireUser();
  const [{ email, pendingEmail }, { data }] = await Promise.all([
    getAccountEmails(supabase),
    supabase.auth.getUser(),
  ]);
  const { hasPassword, google } = signInMethods(data.user);
  return (
    <>
      {google ? (
        // Spec 050 RF-7: Google keeps entering with its own address.
        <p className="text-sm text-muted">
          Si cambias el email, «Continuar con Google» seguirá entrando con tu
          cuenta de Google.
        </p>
      ) : null}
      {hasPassword ? (
        <EmailForm
          action={requestEmailChange}
          email={email}
          pendingEmail={pendingEmail}
        />
      ) : (
        <p className="text-ink">
          {email}. Para cambiarlo, crea antes una contraseña en «Formas de
          entrar».
        </p>
      )}
    </>
  );
}

/** Spec 050 RF-5, RF-6: how the account enters. */
async function SignInSection() {
  const { supabase } = await requireUser();
  const { data } = await supabase.auth.getUser();
  const { hasPassword, google } = signInMethods(data.user);
  if (!google && !googleLoginEnabled()) return null;
  return (
    <Section id="settings-sign-in" title="Formas de entrar">
      <SignInMethods
        hasPassword={hasPassword}
        googleEmail={google?.email ?? null}
        linkAction={linkGoogle}
        unlinkAction={unlinkGoogle}
        createPasswordAction={createPassword}
      />
    </Section>
  );
}

async function PasswordSection() {
  const { supabase } = await requireUser();
  const { data } = await supabase.auth.getUser();
  return signInMethods(data.user).hasPassword ? (
    <PasswordForm action={changePassword} />
  ) : (
    <p className="text-ink">
      Tu cuenta entra con Google. Crea una contraseña en «Formas de entrar».
    </p>
  );
}

async function AccountSection() {
  const { supabase } = await requireUser();
  const { data } = await supabase.auth.getUser();
  return (
    <DeleteAccountDialog
      action={deleteAccount}
      needsPassword={signInMethods(data.user).hasPassword}
    />
  );
}

// An email change link that failed comes back here with ?confirm=invalid (RF-12).
async function ConfirmNotice({ searchParams }: { searchParams: SearchParams }) {
  const { confirm } = await searchParams;
  return <FormAlert message={getConfirmNotice(confirm) ?? undefined} />;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card surface p-5 sm:p-6"
    >
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LOADING = <p className="text-muted">Cargando…</p>;

/** Ajustes: theme (spec 011), interface accent (spec 005), the account (spec 006) and the assistant (spec 015). */
export default function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        Ajustes
      </h1>
      <Suspense fallback={null}>
        <ConfirmNotice searchParams={searchParams} />
      </Suspense>
      {/* ThemePicker and AccentPicker bring their own headings. */}
      <section className="flex flex-col gap-8 rounded-card surface p-5 sm:p-6">
        <Suspense fallback={LOADING}>
          <AppearanceSection />
        </Suspense>
      </section>
      <Section id="settings-profile" title="Perfil">
        <Suspense fallback={LOADING}>
          <ProfileSection />
        </Suspense>
      </Section>
      <Section id="settings-calendar" title="Calendario">
        <Suspense fallback={LOADING}>
          <CalendarSection />
        </Suspense>
      </Section>
      <Section id="settings-notifications" title="Notificaciones">
        <Suspense fallback={LOADING}>
          <NotificationSection />
        </Suspense>
      </Section>
      <Section id="settings-busy" title="Disponibilidad">
        <Suspense fallback={LOADING}>
          <BusySection />
        </Suspense>
      </Section>
      <Section id="settings-assistant" title="Asistente">
        <Suspense fallback={LOADING}>
          <AssistantSection />
        </Suspense>
      </Section>
      <Suspense fallback={null}>
        <SignInSection />
      </Suspense>
      <Section id="settings-email" title="Email">
        <Suspense fallback={LOADING}>
          <EmailSection />
        </Suspense>
      </Section>
      <Section id="settings-password" title="Contraseña">
        <Suspense fallback={LOADING}>
          <PasswordSection />
        </Suspense>
      </Section>
      <Section id="settings-export" title="Tus datos">
        <ExportData load={loadAccountExport} loadIcs={loadCalendarIcs} />
      </Section>
      <Section id="settings-account" title="Cuenta">
        <p className="text-sm text-muted">
          Borrar la cuenta es definitivo. Los calendarios que compartes no se
          borran enseguida: sus miembros tendrán 15 días para conservarlos.
        </p>
        <div>
          <Suspense fallback={LOADING}>
            <AccountSection />
          </Suspense>
        </div>
      </Section>
    </main>
  );
}
