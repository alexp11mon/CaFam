import { T } from "@/components/i18n/locale-provider";

/** Form-level error announced to screen readers (RNF-7). */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <T>{message}</T>
    </p>
  );
}
