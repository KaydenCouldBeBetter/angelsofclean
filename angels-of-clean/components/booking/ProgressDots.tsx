interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressDots({ currentStep, totalSteps }: ProgressDotsProps) {
  return (
    <div
      role="group"
      aria-label={`Step ${currentStep} of ${totalSteps}`}
      className="flex items-center justify-center gap-2 py-3"
    >
      {Array.from({ length: totalSteps }).map((_, i) => {
        // currentStep is 1-based; i is the 0-based index of each dot.
        const isCurrent = i === currentStep - 1;
        const isCompleted = i < currentStep - 1;
        return (
          <div
            key={i}
            role="img"
            aria-label={`Step ${i + 1}${isCompleted ? ", completed" : isCurrent ? ", current" : ""}`}
            aria-current={isCurrent ? "step" : undefined}
            className={`w-2 h-2 rounded-full transition-colors ${
              isCompleted || isCurrent ? "bg-teal-600" : "bg-zinc-200"
            }`}
          />
        );
      })}
    </div>
  );
}
