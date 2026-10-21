/** Form-level error announced to screen readers (RNF-7). */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  );
}
