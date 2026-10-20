// Placeholder until notifications exist. The app can't send email (no domain,
// see docs/BACKLOG.md B31) or SMS yet, so the controls are shown disabled
// rather than pretending to save.
const NOTIFICATION_OPTIONS = [
  { id: "emailNotifications", label: "Email notifications", hint: "New bookings and quote requests" },
  { id: "smsAlerts", label: "SMS alerts", hint: "Same-day schedule changes" },
];

export default function SettingsPage() {
  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">Settings</h1>
          <p className="text-xs text-[#5c5c5e]">Admin preferences</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8 max-w-2xl">
          <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
            <fieldset disabled aria-describedby="notifications-status">
              {/* The badge sits inside the legend so screen readers announce
                  the group as "Notifications, Coming soon". */}
              <legend className="w-full px-6 py-5 flex items-center justify-between gap-4">
                <span className="font-semibold text-[17px] text-[#1c1c1e]">Notifications</span>
                <span className="flex-shrink-0 rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-semibold text-[#92400e]">
                  Coming soon
                </span>
              </legend>
              <div className="h-px bg-[#e2e8e6] mx-6" />

              <p id="notifications-status" className="px-6 pt-4 text-[13px] text-[#5c5c5e]">
                Notifications aren&apos;t available yet. Check the Dashboard and Quotes pages for new
                requests.
              </p>

              <ul className="px-6 py-2">
                {NOTIFICATION_OPTIONS.map((option, i) => (
                  <li key={option.id}>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <label htmlFor={option.id} className="text-[13px]">
                        <span className="block font-medium text-[#1c1c1e]">{option.label}</span>
                        <span className="block text-[#5c5c5e]">{option.hint}</span>
                      </label>
                      <input
                        id={option.id}
                        type="checkbox"
                        className="h-4 w-4 flex-shrink-0 cursor-not-allowed"
                      />
                    </div>
                    {i < NOTIFICATION_OPTIONS.length - 1 && <div className="h-px bg-[#e2e8e6]" />}
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        </div>
      </div>
    </>
  );
}
