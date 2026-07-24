import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { ResolveAndIgnore, AssignMemberAndIgnore, IgnoreOnly } from "./item-actions";

const TYPE_LABEL: Record<string, string> = {
  PAYROLL_RESULT: "ผลการหักเงินเดือน",
  BANK_STATEMENT: "Statement/รายการโอน",
};

const STATUS_LABEL: Record<string, string> = {
  MATCHED: "จับคู่สมาชิกได้ — รอยืนยัน",
  UNMATCHED: "จับคู่ไม่ได้ — รอตรวจสอบ",
  RESOLVED: "บันทึกเรียบร้อยแล้ว",
  IGNORED: "ละเว้นแล้ว",
};

const STATUS_BADGE: Record<string, string> = {
  MATCHED: "bg-accent-soft text-accent",
  UNMATCHED: "bg-flag-soft text-flag",
  RESOLVED: "bg-primary-soft text-primary-ink",
  IGNORED: "bg-surface-2 text-muted",
};

export default async function ImportBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      importedByUser: true,
      reconciliationItems: {
        include: { member: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/reconciliation" className="text-sm text-primary hover:underline">
          ← กลับไปนำเข้า/กระทบยอด
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">
          {TYPE_LABEL[batch.type] ?? batch.type}: {batch.label}
        </h1>
        <p className="mt-1 text-sm text-muted">
          นำเข้าโดย {batch.importedByUser.username} เมื่อ{" "}
          {batch.createdAt.toLocaleString("th-TH")} · {batch.reconciliationItems.length.toLocaleString("th-TH")}{" "}
          รายการ
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">รหัสในไฟล์</th>
              <th className="px-4 py-2.5 text-left font-medium">สมาชิกที่จับคู่ได้</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนเงิน</th>
              <th className="px-4 py-2.5 text-left font-medium">หมายเหตุ</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {batch.reconciliationItems.map((item) => (
              <tr key={item.id} className="border-t border-line align-top">
                <td className="px-4 py-2.5 font-mono text-xs">{item.rawMemberCode}</td>
                <td className="px-4 py-2.5">
                  {item.member ? item.member.fullName : (
                    <span className="text-muted">ไม่พบ</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(item.amountMinor)}
                </td>
                <td className="max-w-xs px-4 py-2.5 text-xs text-muted">{item.note ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status] ?? ""}`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {item.status === "MATCHED" && batch.type === "BANK_STATEMENT" && (
                    <ResolveAndIgnore reconciliationItemId={item.id} />
                  )}
                  {item.status === "UNMATCHED" && batch.type === "BANK_STATEMENT" && (
                    <AssignMemberAndIgnore reconciliationItemId={item.id} />
                  )}
                  {item.status === "UNMATCHED" && batch.type === "PAYROLL_RESULT" && (
                    <IgnoreOnly reconciliationItemId={item.id} />
                  )}
                </td>
              </tr>
            ))}
            {batch.reconciliationItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  ไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
