import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ReconciliationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.role !== "STAFF_FINANCE" && session?.role !== "ADMIN") {
    redirect("/back-office");
  }
  return <>{children}</>;
}
