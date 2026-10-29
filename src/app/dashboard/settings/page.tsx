import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { EmailForm } from "@/components/account/email-form";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { AccentPicker } from "@/components/settings/accent-picker";
import { FormAlert } from "@/components/ui/form-alert";
import { getConfirmNotice } from "@/lib/account/confirm-type";
import { getAccountEmails, getProfile } from "@/lib/account/queries";
import { getAppearance, requireUser } from "@/lib/calendar/queries";
import { setAccent } from "./actions";
import {
  changePassword,
  deleteAccount,
  requestEmailChange,
  saveProfile,
} from "./account-actions";

export const metadata: Metadata = { title: "Ajustes" };

type SearchParams = Promise<{ confirm?: string }>;

// Each section reads the session, so it streams behind <Suspense> (cacheComponents).
async function AccentSection() {
  const { supabase, userId } = await requireUser();
  const { accent } = await getAppearance(supabase, userId);
  return <AccentPicker current={accent} setAccent={setAccent} />;
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

async function EmailSection() {
  const { supabase } = await requireUser();
  const { email, pendingEmail } = await getAccountEmails(supabase);
  return (
    <EmailForm
      action={requestEmailChange}
      email={email}
      pendingEmail={pendingEmail}
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
      className="flex flex-col gap-4 rounded-3xl bg-paper p-5 sm:p-6"
    >
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LOADING = <p className="text-muted">Cargando…</p>;

/** Ajustes: interface accent (spec 005) and the account (spec 006). */
export default function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Ajustes</h1>
      <Suspense fallback={null}>
        <ConfirmNotice searchParams={searchParams} />
      </Suspense>
      {/* AccentPicker brings its own heading. */}
      <section className="rounded-3xl bg-paper p-5 sm:p-6">
        <Suspense fallback={LOADING}>
          <AccentSection />
        </Suspense>
      </section>
      <Section id="settings-profile" title="Perfil">
        <Suspense fallback={LOADING}>
          <ProfileSection />
        </Suspense>
      </Section>
      <Section id="settings-email" title="Email">
        <Suspense fallback={LOADING}>
          <EmailSection />
        </Suspense>
      </Section>
      <Section id="settings-password" title="Contraseña">
        <PasswordForm action={changePassword} />
      </Section>
      <Section id="settings-account" title="Cuenta">
        <p className="text-sm text-muted">
          Borrar la cuenta es definitivo. Los calendarios que compartes no se
          borran enseguida: sus miembros tendrán 15 días para conservarlos.
        </p>
        <div>
          <DeleteAccountDialog action={deleteAccount} />
        </div>
      </Section>
    </main>
  );
}
