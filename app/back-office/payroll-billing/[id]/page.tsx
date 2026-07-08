import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";

export default async function PayrollBillingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const run = await prisma.payrollBillingRun.findUnique({
    where: { id },
    include: {
      generatedByUser: true,
      records: {
        include: { member: true },
        orderBy: { member: { memberCode: "asc" } },
      },
    },
  });

  if (!run) notFound();

  const totals = run.records.reduce(
    (acc, r) => ({
      share: acc.share + r.shareDueMinor,
      savings: acc.savings + r.savingsDueMinor,
      loan: acc.loan + r.loanDueMinor,
      total: acc.total + r.totalDueMinor,
    }),
    { share: 0, savings: 0, loan: 0, total: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/back-office/payroll-billing"
          className="text-sm text-primary hover:underline"
        >
          ← กลับไปรายการเรียกเก็บ
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">
          รายการเรียกเก็บงวด {run.period}
        </h1>
        <p className="mt-1 text-sm text-muted">
          สร้างโดย {run.generatedByUser.username} เมื่อ{" "}
          {run.generatedAt.toLocaleString("th-TH")} · {run.records.length.toLocaleString("th-TH")}{" "}
          คน
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">ค่าหุ้นรวม</p>
          <p className="mt-1 text-lg font-bold text-ink">{formatBaht(totals.share)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">เงินฝากภาคบังคับรวม</p>
          <p className="mt-1 text-lg font-bold text-ink">{formatBaht(totals.savings)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">งวดเงินกู้รวม</p>
          <p className="mt-1 text-lg font-bold text-ink">{formatBaht(totals.loan)}</p>
        </div>
        <div className="rounded-lg border border-primary bg-primary-soft p-4">
          <p className="text-xs text-primary-ink">ยอดเรียกเก็บรวมทั้งสิ้น</p>
          <p className="mt-1 text-lg font-bold text-primary-ink">
            {formatBaht(totals.total)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">รหัสสมาชิก</th>
              <th className="px-4 py-2.5 text-left font-medium">ชื่อ-นามสกุล</th>
              <th className="px-4 py-2.5 text-right font-medium">ค่าหุ้น</th>
              <th className="px-4 py-2.5 text-right font-medium">เงินฝากภาคบังคับ</th>
              <th className="px-4 py-2.5 text-right font-medium">งวดเงินกู้</th>
              <th className="px-4 py-2.5 text-right font-medium">รวมเรียกเก็บ</th>
            </tr>
          </thead>
          <tbody>
            {run.records.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-mono text-xs">{r.member.memberCode}</td>
                <td className="px-4 py-2.5">{r.member.fullName}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(r.shareDueMinor)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(r.savingsDueMinor)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(r.loanDueMinor)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  {formatBaht(r.totalDueMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
