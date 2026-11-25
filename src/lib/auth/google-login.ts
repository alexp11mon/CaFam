/** "Continuar con Google" only once the provider is on in Supabase (spec 050 "Riesgos"). */
export function googleLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
}
