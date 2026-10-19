import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { withAuthTimeout } from "./auth-timeout";

// "unavailable": Supabase Auth didn't answer in time (or answered with a
// network/5xx error), so we can't say who this is. Never grants access.
export type SessionCheck =
  | { state: "signed-in"; role: unknown }
  | { state: "signed-out" }
  | { state: "unavailable" };

// Refreshes the Supabase session cookie on every matched request and reports
// who is signed in. Middleware is the only place that can both read and
// rewrite cookies on the way to a Server Component, so session refresh has to
// happen here rather than in lib/supabase/server.ts.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() refreshes an expired token, then verifies the JWT signature
  // locally against the project's (cached) ES256 signing key, so a page load
  // costs no Auth round trip. It doesn't catch a session revoked before the
  // token expires; requireAdmin's getUser() does, for every server action.
  // Its claims come from the verified token, so app_metadata (server-set,
  // never client-editable) can be trusted for the role.
  const call = await withAuthTimeout(supabase.auth.getClaims());

  let session: SessionCheck;
  if (call.timedOut || isAuthRetryableFetchError(call.value.error)) {
    session = { state: "unavailable" };
  } else if (call.value.error || !call.value.data) {
    session = { state: "signed-out" };
  } else {
    session = { state: "signed-in", role: call.value.data.claims.app_metadata?.role };
  }

  return { supabaseResponse, session };
}
