import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";

const LOAN_TYPE_LABEL: Record<string, string> = {
  EMERGENCY: "เงินกู้ฉุกเฉิน",
  ORDINARY: "เงินกู้สามัญ",
  SPECIAL: "เงินกู้พิเศษ",
};

function bucketFor(daysOverdue: number) {
  if (daysOverdue > 90) return { label: "90+ วัน", cls: "bg-flag-soft text-flag" };
  if (daysOverdue > 60) return { label: "61-90 วัน", cls: "bg-accent-soft text-accent" };
  if (daysOverdue > 30) return { label: "31-60 วัน", cls: "bg-accent-soft text-accent" };
  return { label: "1-30 วัน", cls: "bg-surface-2 text-muted" };
}

export default async function OverdueLoansReportPage() {
  const now = new Date();

  const overdue = await prisma.loanInstallment.findMany({
    where: { status: { not: "PAID" }, dueDate: { lt: now } },
    include: {
      loanContract: {
        include: { member: true, guarantors: { include: { member: true } } },
      },
    },
  });

  const rows = overdue
    .map((inst) => {
      const daysOverdue = Math.floor(
        (now.getTime() - inst.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      const amountOverdueMinor =
        inst.principalDueMinor + inst.interestDueMinor - inst.paidMinor;
      return { inst, daysOverdue, amountOverdueMinor };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const totalMinor = rows.reduce((sum, r) => sum + r.amountOverdueMinor, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/reports" className="text-sm text-primary hover:underline">
          ← กลับไปรายงานผู้บริหาร
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">รายงานหนี้ค้างชำระ</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length.toLocaleString("th-TH")} งวด · รวม {formatBaht(totalMinor)} ·
          เรียงจากค้างนานที่สุดก่อน
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">สมาชิก</th>
              <th className="px-4 py-2.5 text-left font-medium">ประเภทเงินกู้</th>
              <th className="px-4 py-2.5 text-left font-medium">ผู้ค้ำประกัน</th>
              <th className="px-4 py-2.5 text-left font-medium">งวดที่</th>
              <th className="px-4 py-2.5 text-left font-medium">ครบกำหนด</th>
              <th className="px-4 py-2.5 text-right font-medium">ค้างมา (วัน)</th>
              <th className="px-4 py-2.5 text-right font-medium">ยอดค้างชำระ</th>
              <th className="px-4 py-2.5 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ inst, daysOverdue, amountOverdueMinor }) => {
              const bucket = bucketFor(daysOverdue);
              return (
                <tr key={inst.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/back-office/members/${inst.loanContract.memberId}`}
                      className="text-primary hover:underline"
                    >
                      {inst.loanContract.member.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {LOAN_TYPE_LABEL[inst.loanContract.type] ?? inst.loanContract.type}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {inst.loanContract.guarantors.length > 0
                      ? inst.loanContract.guarantors.map((g) => g.member.fullName).join(", ")
                      : "ไม่มี"}
                  </td>
                  <td className="px-4 py-2.5">{inst.installmentNo}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {inst.dueDate.toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{daysOverdue}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {formatBaht(amountOverdueMinor)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${bucket.cls}`}>
                      {bucket.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  ไม่มีหนี้ค้างชำระในขณะนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
