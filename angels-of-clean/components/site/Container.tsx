import { cn } from "@/lib/utils";

// The marketing site's page width: 1440px frames with 120px side margins,
// narrowing to 40px and then 16px on smaller screens.
export default function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 md:px-10 xl:px-30", className)}>{children}</div>;
}
