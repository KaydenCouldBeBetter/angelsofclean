import { connection } from "next/server";
import AdminShell from "./AdminShell";

// Admin pages run under a per-request script nonce (middleware.ts), which
// Next.js can only stamp on pages rendered per request. Waiting for the
// request keeps every admin page out of static prerendering.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <AdminShell>{children}</AdminShell>;
}
