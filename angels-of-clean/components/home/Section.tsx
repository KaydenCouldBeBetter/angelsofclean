import type { ReactNode } from "react";

// A homepage section: an h2 that names the region, then its content. The page
// has one h1 (the hero); everything under a section's h2 is an h3.
export default function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="px-4 py-10 md:px-20 md:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id={headingId} className="text-2xl font-bold text-zinc-900">
            {title}
          </h2>
          {intro && <p className="max-w-2xl text-base text-zinc-600">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
