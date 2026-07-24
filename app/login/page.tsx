import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "MEMBER" ? "/portal" : "/back-office");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-primary">
          สหกรณ์ออมทรัพย์ครูหนองคาย
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink">เข้าสู่ระบบ</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          ระบบเงินฝาก-หุ้น-เงินกู้ของสมาชิก
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
