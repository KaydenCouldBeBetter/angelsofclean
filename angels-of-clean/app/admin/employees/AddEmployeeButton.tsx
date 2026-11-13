"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { nyTodayStr } from "@/lib/datetime";
import { createEmployee } from "./actions";

// The Add Employee button and its dialog. Base UI's modal Dialog names the popup
// by its title, traps focus, closes on Escape and returns focus to the button.
export default function AddEmployeeButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hiredDate, setHiredDate] = useState("");

  function openDialog() {
    setName("");
    setPhone("");
    setHiredDate(nyTodayStr()); // chosen when opened, so the server render never guesses a date
    setError(null);
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEmployee({ name, phone, hiredDate });
      if (result.success) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="bg-primary hover:bg-primary-pressed text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors"
      >
        + Add Employee
      </button>

      <Dialog.Root open={open} onOpenChange={(next) => { if (!isPending) setOpen(next); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Popup
            aria-modal="true"
            className="fixed left-1/2 top-[10vh] z-50 -translate-x-1/2 bg-white rounded-xl shadow-xl w-[460px] max-w-[calc(100vw-2rem)] max-h-[84vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8e6]">
              <Dialog.Title className="text-lg font-semibold text-[#1c1c1e]">Add Employee</Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f0f0f0] text-[#5c5c5e] transition-colors text-lg"
              >
                <span aria-hidden="true">&#10005;</span>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
              <div className="flex flex-col gap-4 px-6 py-5">
                <div>
                  <Label htmlFor="emp-name" className="text-[13px] text-[#1c1c1e] mb-1">Name</Label>
                  <Input
                    id="emp-name"
                    required
                    autoComplete="off"
                    maxLength={FIELD_MAX_LENGTHS.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-describedby="emp-name-hint"
                    className="h-10"
                  />
                  <p id="emp-name-hint" className="mt-1 text-xs text-[#5c5c5e]">
                    First name and last initial, like Marcus T.
                  </p>
                </div>
                <div>
                  <Label htmlFor="emp-phone" className="text-[13px] text-[#1c1c1e] mb-1">Phone</Label>
                  <Input
                    id="emp-phone"
                    type="tel"
                    required
                    autoComplete="off"
                    maxLength={FIELD_MAX_LENGTHS.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(315) 555-0123"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-hired" className="text-[13px] text-[#1c1c1e] mb-1">Hire date</Label>
                  <Input
                    id="emp-hired"
                    type="date"
                    required
                    value={hiredDate}
                    onChange={(e) => setHiredDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-[13px] text-[#1c1c1e]">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e6]">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9 px-5 text-sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="h-9 px-5 text-sm">
                  {isPending ? "Adding..." : "Add Employee"}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
