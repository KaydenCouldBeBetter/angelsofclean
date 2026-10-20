import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { authRetryUrl, isAuthRetryUrl } from "@/lib/supabase/auth-timeout";
import { buildCsp, createNonce } from "@/lib/csp";

const PUBLIC_ADMIN_ROUTES = [
  "/admin",
  "/admin/forgot-password",
  "/admin/reset-password/confirm",
];

// Keeps any refreshed session cookie, so the next request doesn't have to
// refresh it again.
function redirectWithCookies(url: URL, from: NextResponse) {
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function proxy(request: NextRequest) {
  // Next.js reads the nonce from the request's CSP header while rendering and
  // stamps it on its own <script> tags. updateSession forwards these request
  // headers to the page.
  const csp = buildCsp({
    nonce: createNonce(),
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  request.headers.set("Content-Security-Policy", csp);

  // The "couldn't verify your sign-in" screen is part of the public sign-in
  // page and shows no account data, so it doesn't wait on Auth a second time.
  if (isAuthRetryUrl(request.nextUrl)) {
    const response = NextResponse.next({ request });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const { supabaseResponse, session } = await updateSession(request);

  const { pathname } = request.nextUrl;
  // Signed-out admins must reach sign-in and the start of password reset.
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  // Admin pages require the admin role claim, not just a session — any
  // Supabase account can be signed in, but only app_metadata.role === "admin"
  // (server-set, never client-editable) may view the admin panel.
  const isAdmin = session.state === "signed-in" && session.role === "admin";

  // Auth didn't answer in time. Protected pages stay closed, and sign-in
  // can't tell whether to skip to the dashboard, so both show the retry screen
  // rather than a login form the visitor may not need.
  if (session.state === "unavailable" && (!isPublicRoute || pathname === "/admin")) {
    return redirectWithCookies(authRetryUrl(request.nextUrl), supabaseResponse);
  }

  if (!isAdmin && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return redirectWithCookies(url, supabaseResponse);
  }

  // Only admins skip the login form. Non-admins are sent here from every
  // other admin page, so redirecting them onward would loop.
  if (isAdmin && pathname === "/admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return redirectWithCookies(url, supabaseResponse);
  }

  supabaseResponse.headers.set("Content-Security-Policy", csp);
  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
