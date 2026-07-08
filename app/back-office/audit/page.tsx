import { prisma } from "@/lib/prisma";

const ACTION_LABEL: Record<string, string> = {
  CREATE_MEMBER: "สร้างสมาชิก",
  DEPOSIT: "ฝากเงิน",
  WITHDRAWAL: "ถอนเงิน",
  SHARE_CONTRIBUTION: "ซื้อหุ้น",
  CREATE_LOAN: "สร้างคำขอกู้",
  APPROVE_LOAN: "อนุมัติเงินกู้",
  REJECT_LOAN: "ปฏิเสธเงินกู้",
  DISBURSE_LOAN: "เบิกจ่ายเงินกู้",
  RECORD_LOAN_PAYMENT: "บันทึกชำระเงินกู้",
  RUN_INTEREST_ACCRUAL: "ประมวลผลดอกเบี้ย",
  GENERATE_MONTHLY_BILLING: "สร้างรายการเรียกเก็บรายเดือน",
};

export default async function AuditLogPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actorUser: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">
          ประวัติการทำธุรกรรมและการเปลี่ยนแปลงข้อมูลสำคัญ 100 รายการล่าสุด
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">เวลา</th>
              <th className="px-4 py-2.5 text-left font-medium">ผู้ทำรายการ</th>
              <th className="px-4 py-2.5 text-left font-medium">การกระทำ</th>
              <th className="px-4 py-2.5 text-left font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {log.createdAt.toLocaleString("th-TH")}
                </td>
                <td className="px-4 py-2.5">{log.actorUser.username}</td>
                <td className="px-4 py-2.5">
                  {ACTION_LABEL[log.action] ?? log.action}
                </td>
                <td className="max-w-md truncate px-4 py-2.5 font-mono text-xs text-muted">
                  {log.after ?? "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีบันทึก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
