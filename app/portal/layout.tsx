import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "MEMBER") {
    redirect("/back-office");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">
              สหกรณ์ออมทรัพย์ครูหนองคาย
            </p>
            <p className="text-sm font-bold text-ink">พอร์ทัลสมาชิก</p>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/portal" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              ยอดคงเหลือ
            </Link>
            <Link href="/portal/statements" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              ประวัติธุรกรรม
            </Link>
            <Link href="/portal/loans/apply" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              ยื่นกู้
            </Link>
          </nav>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
