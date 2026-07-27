import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function AdminIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/admin/dashboard");
  }

  return <LoginForm />;
}
