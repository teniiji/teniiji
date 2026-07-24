import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";
import { InterestAccrualForm } from "./interest-accrual-form";

export default async function BackOfficeDashboardPage() {
  const session = await getSession();

  const [memberCount, savingsAgg, loanAgg, pendingLoanCount] =
    await Promise.all([
      prisma.member.count(),
      prisma.savingsAccount.aggregate({ _sum: { balanceMinor: true } }),
      prisma.loanContract.aggregate({
        where: { status: "DISBURSED" },
        _sum: { principalMinor: true },
      }),
      prisma.loanContract.count({ where: { status: "SUBMITTED" } }),
    ]);

  const stats = [
    { label: "จำนวนสมาชิก", value: memberCount.toLocaleString("th-TH") },
    {
      label: "ยอดเงินฝากรวม",
      value: formatBaht(savingsAgg._sum.balanceMinor ?? 0),
    },
    {
      label: "เงินกู้คงค้าง (เบิกจ่ายแล้ว)",
      value: formatBaht(loanAgg._sum.principalMinor ?? 0),
    },
    { label: "คำขอกู้รอพิจารณา", value: pendingLoanCount.toLocaleString("th-TH") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-ink">ภาพรวม</h1>
        <p className="mt-1 text-sm text-muted">
          สรุปข้อมูลระบบเงินฝาก-หุ้น-เงินกู้ของสมาชิก
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-line bg-surface p-4"
          >
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1.5 text-lg font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/back-office/members"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          ทะเบียนสมาชิก
        </Link>
        <Link
          href="/back-office/loans"
          className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2"
        >
          รายการเงินกู้
        </Link>
      </div>

      {(session?.role === "MANAGER" || session?.role === "ADMIN") && (
        <InterestAccrualForm />
      )}
    </div>
  );
}
