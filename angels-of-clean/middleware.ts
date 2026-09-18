import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/admin";

  // Admin pages require the admin role claim, not just a session — any
  // Supabase account can be signed in, but only app_metadata.role === "admin"
  // (server-set, never client-editable) may view the admin panel.
  const isAdmin = user?.app_metadata?.role === "admin";

  if (!isAdmin && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
