import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function AdminIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only admins skip the login form — middleware bounces non-admins back
  // here, so redirecting them to the dashboard would loop.
  if (user?.app_metadata?.role === "admin") {
    redirect("/admin/dashboard");
  }

  return <LoginForm />;
}
