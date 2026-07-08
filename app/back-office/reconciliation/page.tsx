import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PayrollImportForm } from "./payroll-import-form";
import { StatementImportForm } from "./statement-import-form";

const TYPE_LABEL: Record<string, string> = {
  PAYROLL_RESULT: "ผลการหักเงินเดือน",
  BANK_STATEMENT: "Statement/รายการโอน",
};

export default async function ReconciliationPage() {
  const [billingRuns, batches] = await Promise.all([
    prisma.payrollBillingRun.findMany({
      orderBy: { period: "desc" },
      select: { id: true, period: true },
    }),
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        importedByUser: true,
        reconciliationItems: true,
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">นำเข้า/กระทบยอด Statement</h1>
        <p className="mt-1 text-sm text-muted">
          นำเข้าไฟล์ผลการหักเงินเดือนจากต้นสังกัด หรือ statement ธนาคาร/รายการโอนจากสมาชิก
          เพื่อกระทบยอดกับระบบ
        </p>
      </div>

      <PayrollImportForm billingRuns={billingRuns} />
      <StatementImportForm />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
              <th className="px-4 py-2.5 text-left font-medium">ชื่อ/งวด</th>
              <th className="px-4 py-2.5 text-left font-medium">นำเข้าโดย</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนแถว</th>
              <th className="px-4 py-2.5 text-right font-medium">รอตรวจสอบ</th>
              <th className="px-4 py-2.5 text-left font-medium">เวลา</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const pendingCount = batch.reconciliationItems.filter(
                (i) => i.status === "MATCHED" || i.status === "UNMATCHED"
              ).length;
              return (
                <tr key={batch.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{TYPE_LABEL[batch.type] ?? batch.type}</td>
                  <td className="px-4 py-2.5">{batch.label}</td>
                  <td className="px-4 py-2.5 text-muted">{batch.importedByUser.username}</td>
                  <td className="px-4 py-2.5 text-right">
                    {batch.rowCount.toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {pendingCount > 0 ? (
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                        {pendingCount.toLocaleString("th-TH")}
                      </span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {batch.createdAt.toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/back-office/reconciliation/${batch.id}`}
                      className="text-primary hover:underline"
                    >
                      ดูรายการ
                    </Link>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีการนำเข้าไฟล์
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
