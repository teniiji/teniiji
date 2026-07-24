import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { getSession, LOAN_ROLES } from "@/lib/session";

const LOAN_TYPE_LABEL: Record<string, string> = {
  EMERGENCY: "เงินกู้ฉุกเฉิน",
  ORDINARY: "เงินกู้สามัญ",
  SPECIAL: "เงินกู้พิเศษ",
};

const LOAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "รอพิจารณา",
  APPROVED: "อนุมัติแล้ว รอเบิกจ่าย",
  DISBURSED: "เบิกจ่ายแล้ว",
  CLOSED: "ปิดบัญชีแล้ว",
  REJECTED: "ปฏิเสธ",
};

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-accent-soft text-accent",
  APPROVED: "bg-primary-soft text-primary-ink",
  DISBURSED: "bg-primary-soft text-primary-ink",
  CLOSED: "bg-surface-2 text-muted",
  REJECTED: "bg-flag-soft text-flag",
  DRAFT: "bg-surface-2 text-muted",
};

export default async function LoansPage() {
  const session = await getSession();
  const canCreateLoan = !!session && LOAN_ROLES.includes(session.role);

  const loans = await prisma.loanContract.findMany({
    orderBy: { createdAt: "desc" },
    include: { member: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">รายการเงินกู้</h1>
          <p className="mt-1 text-sm text-muted">
            ทั้งหมด {loans.length.toLocaleString("th-TH")} รายการ
          </p>
        </div>
        {canCreateLoan && (
          <Link
            href="/back-office/loans/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + สร้างคำขอกู้ใหม่
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">สมาชิก</th>
              <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
              <th className="px-4 py-2.5 text-right font-medium">วงเงิน</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-t border-line">
                <td className="px-4 py-2.5">{loan.member.fullName}</td>
                <td className="px-4 py-2.5">
                  {LOAN_TYPE_LABEL[loan.type] ?? loan.type}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(loan.principalMinor)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[loan.status] ?? ""}`}
                  >
                    {LOAN_STATUS_LABEL[loan.status] ?? loan.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/back-office/loans/${loan.id}`}
                    className="text-primary hover:underline"
                  >
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีรายการเงินกู้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
