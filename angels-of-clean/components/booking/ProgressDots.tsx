interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressDots({ currentStep, totalSteps }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < currentStep ? "bg-teal-600" : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}
