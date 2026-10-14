import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ADMIN_ROUTES = [
  "/admin",
  "/admin/forgot-password",
  "/admin/reset-password/confirm",
];

export async function middleware(request: NextRequest) {
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

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
