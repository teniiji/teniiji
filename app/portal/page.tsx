import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";

const SAVINGS_TYPE_LABEL: Record<string, string> = {
  SAVINGS: "ออมทรัพย์",
  SPECIAL_SAVINGS: "ออมทรัพย์พิเศษ",
  FIXED_TERM: "เงินฝากประจำ",
};

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

export default async function PortalDashboardPage() {
  const session = await getSession();
  if (!session?.memberId) redirect("/login");

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    include: {
      savingsAccounts: true,
      shareAccount: true,
      loanContracts: {
        orderBy: { createdAt: "desc" },
        include: { installments: { orderBy: { installmentNo: "asc" } } },
      },
    },
  });

  if (!member) redirect("/login");

  const totalSavings = member.savingsAccounts.reduce(
    (sum, a) => sum + a.balanceMinor,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">สวัสดี, {member.fullName}</h1>
        <p className="mt-1 text-sm text-muted">
          รหัสสมาชิก {member.memberCode} · {member.affiliation}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">เงินฝากรวม</p>
          <p className="mt-1 text-lg font-bold text-primary-ink">
            {formatBaht(totalSavings)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">มูลค่าหุ้นสะสม</p>
          <p className="mt-1 text-lg font-bold text-primary-ink">
            {formatBaht(member.shareAccount?.balanceMinor ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">เงินกู้ที่ใช้งานอยู่</p>
          <p className="mt-1 text-lg font-bold text-primary-ink">
            {member.loanContracts.filter((l) => l.status === "DISBURSED").length}{" "}
            สัญญา
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">บัญชีเงินฝาก</h2>
        <div className="mt-3 flex flex-col gap-2">
          {member.savingsAccounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {SAVINGS_TYPE_LABEL[acc.type] ?? acc.type}
                </p>
                <p className="text-xs text-muted">{acc.accountNumber}</p>
              </div>
              <p className="font-mono font-semibold text-primary-ink">
                {formatBaht(acc.balanceMinor)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">เงินกู้</h2>
        <div className="mt-3 flex flex-col gap-2">
          {member.loanContracts.map((loan) => {
            const nextDue = loan.installments.find((i) => i.status !== "PAID");
            return (
              <div key={loan.id} className="rounded-md bg-surface-2 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">
                    {LOAN_TYPE_LABEL[loan.type] ?? loan.type} —{" "}
                    {formatBaht(loan.principalMinor)}
                  </p>
                  <span className="text-xs text-muted">
                    {LOAN_STATUS_LABEL[loan.status] ?? loan.status}
                  </span>
                </div>
                {nextDue && (
                  <p className="mt-1 text-xs text-muted">
                    งวดถัดไป #{nextDue.installmentNo} ครบกำหนด{" "}
                    {nextDue.dueDate.toLocaleDateString("th-TH")} ยอด{" "}
                    {formatBaht(
                      nextDue.principalDueMinor +
                        nextDue.interestDueMinor -
                        nextDue.paidMinor
                    )}
                  </p>
                )}
              </div>
            );
          })}
          {member.loanContracts.length === 0 && (
            <p className="text-sm text-muted">ยังไม่มีเงินกู้</p>
          )}
        </div>
      </section>
    </div>
  );
}
