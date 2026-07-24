import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";
import { DecideClaimActions, PayClaimAction } from "./claim-actions";

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

export default async function WelfareClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [claim, session] = await Promise.all([
    prisma.welfareClaim.findUnique({
      where: { id },
      include: { member: true, welfareFund: true },
    }),
    getSession(),
  ]);

  if (!claim) notFound();

  const canDecide = session?.role === "MANAGER" || session?.role === "ADMIN";
  const canPay = session?.role === "STAFF_FINANCE" || session?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/welfare" className="text-sm text-primary hover:underline">
          ← กลับไปสวัสดิการและเงินสงเคราะห์
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">
            {FUND_TYPE_LABEL[claim.welfareFund.type] ?? claim.welfareFund.type} —{" "}
            {claim.member.fullName}
          </h1>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            {CLAIM_STATUS_LABEL[claim.status] ?? claim.status}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">กองทุน</p>
          <p className="mt-1 text-sm font-semibold text-ink">{claim.welfareFund.name}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">จำนวนเงิน</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(claim.requestedAmountMinor)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">วันที่ยื่นคำขอ</p>
          <p className="mt-1 text-sm text-ink">
            {claim.submittedAt.toLocaleDateString("th-TH")}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">เหตุผล/รายละเอียดคำขอ</h2>
        <p className="mt-2 text-sm text-ink">{claim.reason}</p>
        {claim.rejectionReason && (
          <p className="mt-3 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
            เหตุผลการปฏิเสธ: {claim.rejectionReason}
          </p>
        )}
      </section>

      {claim.status === "SUBMITTED" && canDecide && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">พิจารณาคำขอ</h2>
          <p className="mt-1 mb-3 text-xs text-muted">
            ระบบตรวจสอบสิทธิ์เบื้องต้นแล้วตอนยื่นคำขอ (สถานะ/อายุสมาชิกภาพ/หนี้ค้างชำระ)
          </p>
          <DecideClaimActions welfareClaimId={claim.id} />
        </section>
      )}

      {claim.status === "APPROVED" && canPay && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">จ่ายเงินสวัสดิการ</h2>
          <p className="mt-1 mb-3 text-xs text-muted">
            เงินจะเข้าบัญชีเงินฝากออมทรัพย์หลักของสมาชิกโดยอัตโนมัติ
          </p>
          <PayClaimAction welfareClaimId={claim.id} />
        </section>
      )}
    </div>
  );
}
