"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const handleSaveChanges = () => {
    // Here you would typically save the settings to a database or API
    alert("Settings saved successfully!");
    router.push("/admin");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="emailNotifications" className="text-sm font-medium text-zinc-900">
            Email Notifications
          </label>
          <input
            id="emailNotifications"
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="h-4 w-4 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="smsAlerts" className="text-sm font-medium text-zinc-900">
            SMS Alerts
          </label>
          <input
            id="smsAlerts"
            type="checkbox"
            checked={smsAlerts}
            onChange={(e) => setSmsAlerts(e.target.checked)}
            className="h-4 w-4 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>
      </div>
      <button
        onClick={handleSaveChanges}
        className="w-full h-14 text-base font-semibold bg-[#3ebfb5] text-white rounded-lg mt-6 hover:bg-[#38a19e]"
      >
        Save Changes
      </button>
    </div>
  );
}
