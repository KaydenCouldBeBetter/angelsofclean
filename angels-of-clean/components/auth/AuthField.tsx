import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FieldError from "@/components/booking/FieldError";

type AuthFieldProps = Omit<React.ComponentProps<"input">, "id" | "className"> & {
  id: string;
  label: string;
  /** Mount an error to mark the field invalid and announce the message. */
  error?: string | null;
  /** Always-visible help under the field (e.g. a password rule). */
  hint?: string;
};

// A labelled text field for the customer sign-in pages: label above the input
// (never a placeholder alone), the error and the hint tied to the input with
// aria-describedby, and the same 48px input the booking steps use.
export default function AuthField({ id, label, error, hint, ...inputProps }: AuthFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-12"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
