import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  error: {
    box: "border-red-300 bg-red-50 text-red-900",
    icon: CircleAlert,
    iconClass: "text-red-700",
    role: "alert",
  },
  info: {
    box: "border-primary/20 bg-primary/5 text-ink",
    icon: Info,
    iconClass: "text-primary",
    role: "status",
  },
  success: {
    box: "border-primary/20 bg-primary/5 text-ink",
    icon: CircleCheck,
    iconClass: "text-primary",
    role: "status",
  },
} as const;

// A message above or inside a form. The icon and the words carry the meaning,
// never the colour alone. Errors are announced at once (role="alert"); notices
// are announced politely (role="status").
export default function AuthAlert({
  tone,
  className,
  children,
}: {
  tone: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  const { box, icon: Icon, iconClass, role } = TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 h-5 w-5 flex-shrink-0", iconClass)} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
