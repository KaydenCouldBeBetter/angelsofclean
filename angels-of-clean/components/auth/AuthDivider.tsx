// The "or" rule between the main action and the guest path (Figma 120:899).
export default function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span>or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
