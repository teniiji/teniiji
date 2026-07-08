import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";
import { STAFF_ROLES } from "@/lib/session";

const ROLE_LABEL: Record<string, string> = {
  STAFF_FINANCE: "เจ้าหน้าที่การเงิน",
  STAFF_LOAN: "เจ้าหน้าที่สินเชื่อ",
  MANAGER: "ผู้จัดการ",
  ADMIN: "ผู้ดูแลระบบ",
};

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!STAFF_ROLES.includes(session.role)) {
    redirect("/portal");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">
              สหกรณ์ออมทรัพย์ครูหนองคาย
            </p>
            <p className="text-sm font-bold text-ink">ระบบเจ้าหน้าที่ (Back Office)</p>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/back-office" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              สมาชิก
            </Link>
            <Link href="/back-office/loans" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              เงินกู้
            </Link>
            <Link href="/back-office/welfare" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              สวัสดิการ
            </Link>
            <Link href="/back-office/payroll-billing" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              เรียกเก็บรายเดือน
            </Link>
            <Link href="/back-office/audit" className="rounded-md px-3 py-1.5 hover:bg-surface-2">
              Audit Log
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {session.username} · {ROLE_LABEL[session.role] ?? session.role}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
