// One titled card on the Settings page. The section is named by its heading, so
// a screen reader's landmark list reads "Calendar", "Account", and so on.
export default function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
      <div className="px-6 py-5">
        <h2 id={headingId} className="font-semibold text-[17px] text-[#1c1c1e]">
          {title}
        </h2>
        {description && <p className="mt-1 text-[13px] text-[#5c5c5e]">{description}</p>}
      </div>
      <div className="h-px bg-[#e2e8e6] mx-6" />
      <div className="px-6 py-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

// Shared control styling, so every select on the page looks the same.
export const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-[#767676] bg-white px-3 text-sm text-[#1c1c1e] aria-invalid:border-[#c0392b]";
