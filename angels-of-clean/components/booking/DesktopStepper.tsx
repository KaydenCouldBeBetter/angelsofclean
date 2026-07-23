interface Step {
  label: string;
}

interface DesktopStepperProps {
  steps: Step[];
  currentStep: number;
}

export default function DesktopStepper({ steps, currentStep }: DesktopStepperProps) {
  return (
    <div className="hidden lg:flex items-center justify-center h-14 border-b border-zinc-200 bg-white">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isUpcoming = stepNum > currentStep;

        return (
          <div key={step.label} className="flex items-center">
            {/* Dot */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                isCompleted || isCurrent
                  ? "bg-[#1a6b5a] text-white"
                  : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {stepNum}
            </div>

            {/* Label */}
            <span
              className={`ml-2 text-sm whitespace-nowrap ${
                isCurrent
                  ? "font-semibold text-zinc-900"
                  : isCompleted
                    ? "font-medium text-zinc-500 line-through"
                    : "font-medium text-zinc-400"
              }`}
            >
              {step.label}
            </span>

            {/* Connecting line */}
            {i < steps.length - 1 && (
              <div
                className={`w-16 xl:w-24 h-0.5 mx-3 flex-shrink-0 ${
                  stepNum < currentStep ? "bg-[#1a6b5a]" : "bg-zinc-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
