import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";

const TXN_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "ฝากเงิน",
  WITHDRAWAL: "ถอนเงิน",
  SHARE_CONTRIBUTION: "ซื้อหุ้น",
  LOAN_DISBURSEMENT: "เบิกจ่ายเงินกู้",
  LOAN_PAYMENT: "ชำระเงินกู้",
  INTEREST_ACCRUAL: "ดอกเบี้ยเงินฝาก",
};

export default async function StatementsPage() {
  const session = await getSession();
  if (!session?.memberId) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { memberId: session.memberId },
    orderBy: { createdAt: "desc" },
    include: { savingsAccount: true, shareAccount: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ประวัติธุรกรรม</h1>
        <p className="mt-1 text-sm text-muted">
          ทั้งหมด {transactions.length.toLocaleString("th-TH")} รายการ
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">วันที่</th>
              <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
              <th className="px-4 py-2.5 text-left font-medium">บัญชี</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {t.createdAt.toLocaleString("th-TH")}
                </td>
                <td className="px-4 py-2.5">{TXN_TYPE_LABEL[t.type] ?? t.type}</td>
                <td className="px-4 py-2.5 text-muted">
                  {t.savingsAccount?.accountNumber ?? (t.shareAccountId ? "บัญชีหุ้น" : "-")}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(t.amountMinor)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีธุรกรรม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
