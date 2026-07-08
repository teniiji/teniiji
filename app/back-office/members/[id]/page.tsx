import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { DepositWithdrawForm, ShareContributionForm } from "./account-forms";

const SAVINGS_TYPE_LABEL: Record<string, string> = {
  SAVINGS: "ออมทรัพย์",
  SPECIAL_SAVINGS: "ออมทรัพย์พิเศษ",
  FIXED_TERM: "เงินฝากประจำ",
};

const LOAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "รอพิจารณา",
  APPROVED: "อนุมัติแล้ว รอเบิกจ่าย",
  DISBURSED: "เบิกจ่ายแล้ว",
  CLOSED: "ปิดบัญชีแล้ว",
  REJECTED: "ปฏิเสธ",
};

const TXN_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "ฝากเงิน",
  WITHDRAWAL: "ถอนเงิน",
  SHARE_CONTRIBUTION: "ซื้อหุ้น",
  LOAN_DISBURSEMENT: "เบิกจ่ายเงินกู้",
  LOAN_PAYMENT: "ชำระเงินกู้",
  INTEREST_ACCRUAL: "ดอกเบี้ยเงินฝาก",
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      savingsAccounts: true,
      shareAccount: true,
      loanContracts: { orderBy: { createdAt: "desc" } },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!member) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/members" className="text-sm text-primary hover:underline">
          ← กลับไปทะเบียนสมาชิก
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">{member.fullName}</h1>
        <p className="mt-1 text-sm text-muted">
          รหัสสมาชิก {member.memberCode} · {member.affiliation}
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">บัญชีเงินฝาก</h2>
        <div className="mt-3 flex flex-col gap-4">
          {member.savingsAccounts.map((acc) => (
            <div key={acc.id} className="rounded-md bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {SAVINGS_TYPE_LABEL[acc.type] ?? acc.type}
                  </p>
                  <p className="text-xs text-muted">
                    เลขบัญชี {acc.accountNumber} · ดอกเบี้ย{" "}
                    {(acc.interestRateBps / 100).toFixed(2)}% ต่อปี
                    {acc.mandatoryMonthlyMinor > 0 && (
                      <>
                        {" "}
                        · เงินฝากภาคบังคับ {formatBaht(acc.mandatoryMonthlyMinor)}/เดือน
                      </>
                    )}
                  </p>
                </div>
                <p className="text-lg font-bold text-primary-ink">
                  {formatBaht(acc.balanceMinor)}
                </p>
              </div>
              <DepositWithdrawForm savingsAccountId={acc.id} memberId={member.id} />
            </div>
          ))}
        </div>
      </section>

      {member.shareAccount && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">บัญชีหุ้น</h2>
            <p className="text-lg font-bold text-primary-ink">
              {formatBaht(member.shareAccount.balanceMinor)}
            </p>
          </div>
          <ShareContributionForm
            shareAccountId={member.shareAccount.id}
            memberId={member.id}
          />
        </section>
      )}

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">เงินกู้</h2>
          <Link
            href={`/back-office/loans/new?memberId=${member.id}`}
            className="text-sm text-primary hover:underline"
          >
            + สร้างคำขอกู้ใหม่
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {member.loanContracts.map((loan) => (
            <Link
              key={loan.id}
              href={`/back-office/loans/${loan.id}`}
              className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-2.5 text-sm hover:bg-primary-soft"
            >
              <span>
                {loan.type} · {formatBaht(loan.principalMinor)}
              </span>
              <span className="text-xs text-muted">
                {LOAN_STATUS_LABEL[loan.status] ?? loan.status}
              </span>
            </Link>
          ))}
          {member.loanContracts.length === 0 && (
            <p className="text-sm text-muted">สมาชิกยังไม่มีเงินกู้</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">ประวัติธุรกรรมล่าสุด</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 text-left font-medium">วันที่</th>
                <th className="py-1.5 text-left font-medium">ประเภท</th>
                <th className="py-1.5 text-right font-medium">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {member.transactions.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-1.5 text-muted">
                    {t.createdAt.toLocaleString("th-TH")}
                  </td>
                  <td className="py-1.5">{TXN_TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="py-1.5 text-right font-mono">
                    {formatBaht(t.amountMinor)}
                  </td>
                </tr>
              ))}
              {member.transactions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted">
                    ยังไม่มีธุรกรรม
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
