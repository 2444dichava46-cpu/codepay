import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function DashboardRouter() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === "CLIENT" ? "/dashboard/client" : "/dashboard/developer");
}
