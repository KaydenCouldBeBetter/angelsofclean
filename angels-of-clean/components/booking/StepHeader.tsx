import Link from "next/link";

interface StepHeaderProps {
  step: number;
  totalSteps: number;
  backHref: string;
}

export default function StepHeader({ step, totalSteps, backHref }: StepHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-100 bg-white">
      <Link
        href={backHref}
        className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center"
      >
        ← Back
      </Link>
      <span className="text-sm text-zinc-500">
        Step {step} of {totalSteps}
      </span>
      <div className="min-w-[44px]" />
    </div>
  );
}
