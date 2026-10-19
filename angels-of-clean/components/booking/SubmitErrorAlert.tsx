import { BUSINESS_PHONE } from "@/lib/constants";

interface SubmitErrorAlertProps {
  title: string;
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

// Shown on a review page when a submit fails: icon and color together (never
// color alone), a retry button, and the business phone for anyone who would
// rather call than keep trying.
export default function SubmitErrorAlert({
  title,
  message,
  onRetry,
  retrying,
}: SubmitErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-700"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-red-900">{title}</p>
        <p className="mt-0.5 text-red-800">{message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-11 items-center rounded-lg border border-red-700 bg-white px-5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            {retrying ? "Trying…" : "Try again"}
          </button>
          <span className="text-red-900">
            Or call us at{" "}
            <a
              href={BUSINESS_PHONE.tel}
              className="font-semibold underline underline-offset-2"
            >
              {BUSINESS_PHONE.display}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
