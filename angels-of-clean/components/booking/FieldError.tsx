// Accessible inline error for form fields. Mount it when an error is active;
// its role="alert" causes screen readers to announce the message immediately.
// Point the associated input at it via aria-describedby={id} and set
// aria-invalid={true} on the input while this element is mounted.
export default function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-[#c0392b]">
      {children}
    </p>
  );
}
