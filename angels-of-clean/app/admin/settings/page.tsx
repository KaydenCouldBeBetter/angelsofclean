import { requireAdmin } from "@/lib/supabase/require-admin";
import { readAdminPreferences } from "@/lib/supabase/admin-preferences";
import { readBookingControls } from "@/lib/supabase/booking-settings";
import { nyTodayStr } from "@/lib/datetime";
import LoadError, { ErrorAlert } from "../LoadError";
import AccountSection from "./AccountSection";
import NotificationsCard from "./NotificationsCard";
import OnlineBookingSection from "./OnlineBookingSection";
import PreferencesForm from "./PreferencesForm";
import SettingsSummary from "./SettingsSummary";

// The label above one column of cards. Visible text, and the name of the group
// around that column for a screen reader.
function GroupHeading({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p id={id} className="text-xs font-semibold uppercase tracking-wide text-primary-pressed">
        {title}
      </p>
      <p className="mt-0.5 text-[13px] text-[#5c5c5e]">{children}</p>
    </div>
  );
}

export default async function SettingsPage() {
  // One verified Auth call for this page: it gives the email and the saved
  // display name fresh, and the same session reads the preferences.
  const auth = await requireAdmin();
  const today = nyTodayStr();
  const [prefs, controls] = auth.ok
    ? await Promise.all([readAdminPreferences(auth.supabase), readBookingControls(auth.supabase, today)])
    : [null, null];

  const savedName = auth.ok ? auth.user.user_metadata?.full_name : undefined;
  const displayName = typeof savedName === "string" ? savedName : "";

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">Settings</h1>
          <p className="text-xs text-[#5c5c5e]">Your preferences and online booking</p>
        </div>
      </header>

      {!auth.ok ? (
        <LoadError what="your settings" />
      ) : (
        /* Content */
        <div className="flex-1 overflow-auto bg-[#f7f9f8]">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-8">
            {controls?.ok && <SettingsSummary controls={controls.data} />}

            {/* Side by side from xl up (the sidebar already takes 240px); one column below. */}
            <div className="grid items-start gap-8 xl:grid-cols-2">
              <div role="group" aria-labelledby="mine-heading" className="flex flex-col gap-6">
                <GroupHeading id="mine-heading" title="Your preferences">
                  These change how the panel looks for you only.
                </GroupHeading>

                {prefs?.ok ? (
                  <PreferencesForm initial={prefs.data} />
                ) : (
                  <ErrorAlert
                    title="We couldn't load your preferences"
                    message="This is a problem reaching the database. The rest of the panel still works with the standard settings. Reload to try again."
                  />
                )}

                <AccountSection email={auth.user.email ?? ""} displayName={displayName} />
              </div>

              <div role="group" aria-labelledby="shared-heading" className="flex flex-col gap-6">
                <GroupHeading id="shared-heading" title="Shared with every admin">
                  These apply to every admin and to what customers can book.
                </GroupHeading>

                {controls?.ok ? (
                  <OnlineBookingSection controls={controls.data} today={today} />
                ) : (
                  <ErrorAlert
                    title="We couldn't load the online booking settings"
                    message="This is a problem reaching the database. Customers can still book as before. Reload to try again."
                  />
                )}

                <NotificationsCard />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
