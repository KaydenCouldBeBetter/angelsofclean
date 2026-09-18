"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  // Valid credentials but no admin role claim — don't leave a signed-in
  // session that every admin surface would then refuse.
  if (data.user?.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "This account is not authorized for the admin portal." };
  }

  redirect("/admin/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin");
}
