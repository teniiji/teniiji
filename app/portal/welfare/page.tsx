import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";
import { ApplyWelfareForm } from "./apply-form";

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

export default async function PortalWelfarePage() {
  const session = await getSession();
  if (!session?.memberId) redirect("/login");

  const [funds, claims] = await Promise.all([
    prisma.welfareFund.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.welfareClaim.findMany({
      where: { memberId: session.memberId },
      orderBy: { submittedAt: "desc" },
      include: { welfareFund: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">สวัสดิการและเงินสงเคราะห์</h1>
        <p className="mt-1 text-sm text-muted">
          ตรวจสอบสิทธิ์และยื่นคำขอรับสวัสดิการของสมาชิก
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">กองทุนที่เปิดรับคำขอ</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {funds.map((fund) => (
            <div key={fund.id} className="rounded-md bg-surface-2 p-4">
              <span className="text-xs font-semibold text-primary">
                {FUND_TYPE_LABEL[fund.type] ?? fund.type}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink">{fund.name}</p>
              <p className="mt-1 text-xs text-muted">
                {formatBaht(fund.benefitAmountMinor)} ต่อคำขอ
              </p>
            </div>
          ))}
          {funds.length === 0 && (
            <p className="text-sm text-muted">ยังไม่มีกองทุนที่เปิดรับคำขอในขณะนี้</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">ยื่นคำขอใหม่</h2>
        <div className="mt-3">
          <ApplyWelfareForm funds={funds.map((f) => ({ id: f.id, name: f.name }))} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">คำขอของฉัน</h2>
        <div className="mt-3 flex flex-col gap-2">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="flex items-center justify-between rounded-md bg-surface-2 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {FUND_TYPE_LABEL[claim.welfareFund.type] ?? claim.welfareFund.type}
                </p>
                <p className="text-xs text-muted">{formatBaht(claim.requestedAmountMinor)}</p>
              </div>
              <span className="text-xs text-muted">
                {CLAIM_STATUS_LABEL[claim.status] ?? claim.status}
              </span>
            </div>
          ))}
          {claims.length === 0 && (
            <p className="text-sm text-muted">ยังไม่มีคำขอสวัสดิการ</p>
          )}
        </div>
      </section>
    </div>
  );
}
