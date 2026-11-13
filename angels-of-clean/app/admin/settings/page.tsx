import { requireAdmin } from "@/lib/supabase/require-admin";
import { readAdminPreferences } from "@/lib/supabase/admin-preferences";
import { readBookingControls } from "@/lib/supabase/booking-settings";
import { nyTodayStr } from "@/lib/datetime";
import LoadError, { ErrorAlert } from "../LoadError";
import AccountSection from "./AccountSection";
import NotificationsCard from "./NotificationsCard";
import OnlineBookingSection from "./OnlineBookingSection";
import PreferencesForm from "./PreferencesForm";

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
          <div className="p-8 max-w-2xl flex flex-col gap-6">
            <p className="text-[13px] text-[#5c5c5e]">
              Your preferences change how the panel looks for you only. The online booking settings are shared:
              they apply to every admin and to what customers can book.
            </p>

            {prefs?.ok ? (
              <PreferencesForm initial={prefs.data} />
            ) : (
              <ErrorAlert
                title="We couldn't load your preferences"
                message="This is a problem reaching the database. The rest of the panel still works with the standard settings. Reload to try again."
              />
            )}

            {controls?.ok ? (
              <OnlineBookingSection controls={controls.data} today={today} />
            ) : (
              <ErrorAlert
                title="We couldn't load the online booking settings"
                message="This is a problem reaching the database. Customers can still book as before. Reload to try again."
              />
            )}

            <AccountSection email={auth.user.email ?? ""} displayName={displayName} />

            <NotificationsCard />
          </div>
        </div>
      )}
    </>
  );
}
