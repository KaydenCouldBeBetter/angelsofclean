import "server-only";
import { createPublicClient } from "./public";
import { parseBookingRules, type BookingRules } from "@/lib/booking-rules";

export type PublicRulesResult = { ok: true; data: BookingRules } | { ok: false };

/**
 * The online booking rules, as a signed-out visitor may read them (the
 * get_booking_rules function: pause, notice, day limit, upcoming closed days).
 * A failed or malformed answer is `{ ok: false }`, never "no rules", so a
 * database problem can't switch the pause off by accident.
 */
export async function getPublicBookingRules(): Promise<PublicRulesResult> {
  try {
    const { data, error } = await createPublicClient().rpc("get_booking_rules");
    if (error) {
      // Only the Postgres code and a correlation id, like every other query helper.
      console.error("getPublicBookingRules failed", {
        code: error.code ?? "unknown",
        correlationId: crypto.randomUUID(),
      });
      return { ok: false };
    }
    const rules = parseBookingRules(data);
    if (!rules) {
      console.error("getPublicBookingRules failed", { code: "malformed", correlationId: crypto.randomUUID() });
      return { ok: false };
    }
    return { ok: true, data: rules };
  } catch {
    console.error("getPublicBookingRules failed", { code: "threw", correlationId: crypto.randomUUID() });
    return { ok: false };
  }
}
