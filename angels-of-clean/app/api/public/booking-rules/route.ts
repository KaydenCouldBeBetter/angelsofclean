import { NextResponse } from "next/server";
import { getPublicBookingRules } from "@/lib/supabase/booking-rules";

// The booking wizard asks this once per step to learn whether booking is paused,
// which days are closed and how far ahead it may offer. Anyone may call it: it
// returns only what get_booking_rules() exposes to a signed-out visitor, so
// there is nothing here to protect. A short shared cache keeps a busy day from
// turning every step into a database call; the rules are enforced again, with
// fresh data, when the booking is submitted.
// Read per request. Nothing here touches cookies or headers, so without this a
// build could freeze today's rules into the page and a pause would never show.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getPublicBookingRules();
  if (!result.ok) {
    // An outage, never an empty answer the wizard could read as "no rules".
    return NextResponse.json({ error: "Booking rules unavailable" }, { status: 503 });
  }
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
