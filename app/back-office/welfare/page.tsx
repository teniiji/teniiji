import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { getSession, MANAGER_ADMIN_ROLES } from "@/lib/session";
import { CreateFundForm } from "./create-fund-form";

const FUND_TYPE_LABEL: Record<string, string> = {
  FUNERAL: "เงินสงเคราะห์ศพ",
  EDUCATION: "ทุนการศึกษาบุตร",
  MEDICAL: "รักษาพยาบาล",
};

const CLAIM_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "รอพิจารณา",
  APPROVED: "อนุมัติแล้ว รอจ่ายเงิน",
  REJECTED: "ปฏิเสธ",
  PAID: "จ่ายเงินแล้ว",
};

const CLAIM_STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-accent-soft text-accent",
  APPROVED: "bg-primary-soft text-primary-ink",
  PAID: "bg-primary-soft text-primary-ink",
  REJECTED: "bg-flag-soft text-flag",
};

export default async function WelfarePage() {
  const session = await getSession();
  const canManageFunds = !!session && MANAGER_ADMIN_ROLES.includes(session.role);

  const [funds, claims] = await Promise.all([
    prisma.welfareFund.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.welfareClaim.findMany({
      orderBy: { submittedAt: "desc" },
      include: { member: true, welfareFund: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">สวัสดิการและเงินสงเคราะห์</h1>
          <p className="mt-1 text-sm text-muted">
            กองทุนทั้งหมด {funds.length.toLocaleString("th-TH")} กองทุน · คำขอทั้งหมด{" "}
            {claims.length.toLocaleString("th-TH")} รายการ
          </p>
        </div>
        <Link
          href="/back-office/welfare/new-claim"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + ยื่นคำขอแทนสมาชิก
        </Link>
      </div>

      {canManageFunds && <CreateFundForm />}

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">กองทุนสวัสดิการ</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {funds.map((fund) => (
            <div key={fund.id} className="rounded-md bg-surface-2 p-4">
              <span className="text-xs font-semibold text-primary">
                {FUND_TYPE_LABEL[fund.type] ?? fund.type}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink">{fund.name}</p>
              <p className="mt-1 text-xs text-muted">
                {formatBaht(fund.benefitAmountMinor)} ต่อคำขอ
                {fund.minMembershipMonths > 0 &&
                  ` · อายุสมาชิกภาพขั้นต่ำ ${fund.minMembershipMonths} เดือน`}
              </p>
            </div>
          ))}
          {funds.length === 0 && (
            <p className="text-sm text-muted">ยังไม่มีกองทุนสวัสดิการ</p>
          )}
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">สมาชิก</th>
              <th className="px-4 py-2.5 text-left font-medium">กองทุน</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนเงิน</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-t border-line">
                <td className="px-4 py-2.5">{claim.member.fullName}</td>
                <td className="px-4 py-2.5">
                  {FUND_TYPE_LABEL[claim.welfareFund.type] ?? claim.welfareFund.type}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatBaht(claim.requestedAmountMinor)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLAIM_STATUS_BADGE[claim.status] ?? ""}`}
                  >
                    {CLAIM_STATUS_LABEL[claim.status] ?? claim.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/back-office/welfare/claims/${claim.id}`}
                    className="text-primary hover:underline"
                  >
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีคำขอสวัสดิการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
