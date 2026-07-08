import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatBaht } from "@/lib/money";
import {
  ApproveRejectActions,
  DisburseAction,
  RecordPaymentForm,
} from "./loan-actions";

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

const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "ยังไม่ชำระ",
  PARTIAL: "ชำระบางส่วน",
  PAID: "ชำระครบแล้ว",
};

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [loan, session] = await Promise.all([
    prisma.loanContract.findUnique({
      where: { id },
      include: {
        member: true,
        guarantors: { include: { member: true } },
        installments: { orderBy: { installmentNo: "asc" } },
      },
    }),
    getSession(),
  ]);

  if (!loan) notFound();

  const canApprove = session?.role === "MANAGER" || session?.role === "ADMIN";
  const canReject =
    session?.role === "STAFF_LOAN" ||
    session?.role === "MANAGER" ||
    session?.role === "ADMIN";
  const canDisburse = session?.role === "STAFF_FINANCE" || session?.role === "ADMIN";
  const canRecordPayment =
    session?.role === "STAFF_FINANCE" ||
    session?.role === "MANAGER" ||
    session?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/loans" className="text-sm text-primary hover:underline">
          ← กลับไปรายการเงินกู้
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">
            {LOAN_TYPE_LABEL[loan.type] ?? loan.type} — {loan.member.fullName}
          </h1>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            {LOAN_STATUS_LABEL[loan.status] ?? loan.status}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">วงเงินกู้</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(loan.principalMinor)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">อัตราดอกเบี้ยต่อปี</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {(loan.interestRateBps / 100).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">ระยะเวลากู้</p>
          <p className="mt-1 text-lg font-bold text-ink">{loan.termMonths} เดือน</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">หลักประกัน</p>
          <p className="mt-1 text-sm text-ink">{loan.collateralNote ?? "ไม่มี"}</p>
        </div>
      </section>

      {loan.guarantors.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">ผู้ค้ำประกัน</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {loan.guarantors.map((g) => (
              <li key={g.id}>
                {g.member.fullName} ({g.member.memberCode}) — ค้ำประกัน{" "}
                {formatBaht(g.guaranteedAmountMinor)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loan.status === "SUBMITTED" && (canApprove || canReject) && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">พิจารณาคำขอกู้</h2>
          <p className="mt-1 mb-3 text-xs text-muted">
            การอนุมัติต้องทำโดยผู้จัดการ/แอดมิน แยกจากเจ้าหน้าที่สินเชื่อที่สร้างคำขอ (maker-checker)
          </p>
          <ApproveRejectActions
            loanContractId={loan.id}
            showApprove={canApprove}
            showReject={canReject}
          />
        </section>
      )}

      {loan.status === "APPROVED" && canDisburse && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">เบิกจ่ายเงินกู้</h2>
          <p className="mt-1 mb-3 text-xs text-muted">
            ระบบจะสร้างตารางผ่อนชำระและนำเงินเข้าบัญชีเงินฝากออมทรัพย์ของสมาชิกอัตโนมัติ
          </p>
          <DisburseAction loanContractId={loan.id} />
        </section>
      )}

      {loan.installments.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">ตารางผ่อนชำระ</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1.5 text-left font-medium">งวดที่</th>
                  <th className="py-1.5 text-left font-medium">ครบกำหนด</th>
                  <th className="py-1.5 text-right font-medium">เงินต้น</th>
                  <th className="py-1.5 text-right font-medium">ดอกเบี้ย</th>
                  <th className="py-1.5 text-right font-medium">รวม</th>
                  <th className="py-1.5 text-right font-medium">ชำระแล้ว</th>
                  <th className="py-1.5 text-left font-medium">สถานะ</th>
                  {canRecordPayment && <th className="py-1.5 text-left font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {loan.installments.map((inst) => (
                  <tr key={inst.id} className="border-t border-line">
                    <td className="py-1.5">{inst.installmentNo}</td>
                    <td className="py-1.5 text-muted">
                      {inst.dueDate.toLocaleDateString("th-TH")}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatBaht(inst.principalDueMinor)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatBaht(inst.interestDueMinor)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatBaht(inst.principalDueMinor + inst.interestDueMinor)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatBaht(inst.paidMinor)}
                    </td>
                    <td className="py-1.5">
                      {INSTALLMENT_STATUS_LABEL[inst.status] ?? inst.status}
                    </td>
                    {canRecordPayment && (
                      <td className="py-1.5">
                        {inst.status !== "PAID" && (
                          <RecordPaymentForm loanInstallmentId={inst.id} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
