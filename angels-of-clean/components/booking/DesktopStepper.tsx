interface DesktopStepperProps {
  steps: readonly string[];
  currentStep: number; // 1-based
}

export default function DesktopStepper({ steps, currentStep }: DesktopStepperProps) {
  return (
    <nav
      aria-label="Progress"
      className="hidden md:flex items-center justify-center h-14 border-b border-zinc-200 bg-white"
    >
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-center"
            >
              {/* Dot */}
              <div
                aria-hidden="true"
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  isCompleted || isCurrent
                    ? "bg-primary text-white"
                    : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {stepNum}
              </div>

              {/* Label */}
              <span
                className={`ml-2 text-sm whitespace-nowrap ${
                  isCurrent ? "font-semibold text-zinc-900" : "font-medium text-zinc-500"
                }`}
              >
                <span className="sr-only">Step {stepNum}: </span>
                {label}
                {isCompleted && <span className="sr-only"> (completed)</span>}
              </span>

              {/* Connecting line */}
              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`w-6 lg:w-16 xl:w-24 h-0.5 mx-3 flex-shrink-0 ${
                    isCompleted ? "bg-primary" : "bg-zinc-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
