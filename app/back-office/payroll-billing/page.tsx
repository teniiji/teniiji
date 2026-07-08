import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { GenerateBillingForm } from "./generate-billing-form";

export default async function PayrollBillingPage() {
  const runs = await prisma.payrollBillingRun.findMany({
    orderBy: { period: "desc" },
    include: {
      generatedByUser: true,
      records: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">เรียกเก็บรายเดือน</h1>
        <p className="mt-1 text-sm text-muted">
          รายการยอดที่ขอหักเงินเดือนของสมาชิก ส่งให้ต้นสังกัดหักผ่านเงินเดือนทุกเดือน
        </p>
      </div>

      <GenerateBillingForm />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">งวด</th>
              <th className="px-4 py-2.5 text-left font-medium">สร้างโดย</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนสมาชิก</th>
              <th className="px-4 py-2.5 text-right font-medium">ยอดรวม</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const total = run.records.reduce((sum, r) => sum + r.totalDueMinor, 0);
              return (
                <tr key={run.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-mono">{run.period}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {run.generatedByUser.username}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {run.records.length.toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatBaht(total)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/back-office/payroll-billing/${run.id}`}
                      className="text-primary hover:underline"
                    >
                      ดูรายการ
                    </Link>
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีรายการเรียกเก็บ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
