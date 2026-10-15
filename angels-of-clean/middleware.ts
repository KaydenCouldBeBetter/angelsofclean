import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp, createNonce } from "@/lib/csp";

const PUBLIC_ADMIN_ROUTES = [
  "/admin",
  "/admin/forgot-password",
  "/admin/reset-password/confirm",
];

export async function middleware(request: NextRequest) {
  // Next.js reads the nonce from the request's CSP header while rendering and
  // stamps it on its own <script> tags. updateSession forwards these request
  // headers to the page.
  const csp = buildCsp({
    nonce: createNonce(),
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  request.headers.set("Content-Security-Policy", csp);

  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  // Signed-out admins must reach sign-in and the start of password reset.
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  // Admin pages require the admin role claim, not just a session — any
  // Supabase account can be signed in, but only app_metadata.role === "admin"
  // (server-set, never client-editable) may view the admin panel.
  const isAdmin = user?.app_metadata?.role === "admin";

  if (!isAdmin && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  supabaseResponse.headers.set("Content-Security-Policy", csp);
  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
