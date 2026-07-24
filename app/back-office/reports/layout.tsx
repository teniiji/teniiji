import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.role !== "MANAGER" && session?.role !== "ADMIN") {
    redirect("/back-office");
  }
  return <>{children}</>;
}
