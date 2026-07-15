import { COMMERCIAL_STEP_LABELS } from "@/lib/constants";

interface CommercialStepperProps {
  currentStep: number; // 1-based
}

export default function CommercialStepper({ currentStep }: CommercialStepperProps) {
  return (
    <div className="hidden md:flex w-full border-b border-zinc-200 bg-white">
      <div className="w-full max-w-3xl mx-auto px-8 py-4">
        <ol className="flex items-center" aria-label="Progress">
          {COMMERCIAL_STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isComplete = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <li key={label} className="flex items-center flex-1 last:flex-none">
                {/* Circle + label */}
                <div className="flex flex-col items-center">
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      isComplete
                        ? "bg-teal-700 text-white"
                        : isCurrent
                        ? "bg-teal-600 text-white"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span
                    className={`text-xs mt-1 text-center leading-tight max-w-[80px] ${
                      isCurrent ? "text-teal-700 font-semibold" : "text-zinc-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Connecting line (not after last step) */}
                {i < COMMERCIAL_STEP_LABELS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 mb-5 transition-colors ${
                      isComplete ? "bg-teal-600" : "bg-zinc-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
