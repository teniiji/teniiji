import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";

const OVERDUE_BUCKETS = [
  { key: "d1_30", label: "1-30 วัน", min: 1, max: 30 },
  { key: "d31_60", label: "31-60 วัน", min: 31, max: 60 },
  { key: "d61_90", label: "61-90 วัน", min: 61, max: 90 },
  { key: "d90plus", label: "90 วันขึ้นไป (เสี่ยงเป็นหนี้สูญ)", min: 91, max: Infinity },
] as const;

export default async function ExecutiveReportsPage() {
  const now = new Date();

  const [
    memberStatusCounts,
    savingsAgg,
    shareAgg,
    outstandingLoanAgg,
    welfarePaidAgg,
    overdueInstallments,
  ] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.savingsAccount.aggregate({ _sum: { balanceMinor: true } }),
    prisma.shareAccount.aggregate({ _sum: { balanceMinor: true } }),
    prisma.loanContract.aggregate({
      where: { status: "DISBURSED" },
      _sum: { principalMinor: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "WELFARE_PAYOUT" },
      _sum: { amountMinor: true },
    }),
    prisma.loanInstallment.findMany({
      where: { status: { not: "PAID" }, dueDate: { lt: now } },
      include: { loanContract: { include: { member: true } } },
    }),
  ]);

  const statusLabel: Record<string, string> = {
    ACTIVE: "ปฏิบัติงาน",
    RETIRED: "เกษียณ",
    RESIGNED: "ลาออก",
  };

  const overdueRows = overdueInstallments.map((inst) => {
    const daysOverdue = Math.floor(
      (now.getTime() - inst.dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const amountOverdueMinor =
      inst.principalDueMinor + inst.interestDueMinor - inst.paidMinor;
    return { daysOverdue, amountOverdueMinor };
  });

  const bucketSummary = OVERDUE_BUCKETS.map((bucket) => {
    const rows = overdueRows.filter(
      (r) => r.daysOverdue >= bucket.min && r.daysOverdue <= bucket.max
    );
    return {
      ...bucket,
      count: rows.length,
      totalMinor: rows.reduce((sum, r) => sum + r.amountOverdueMinor, 0),
    };
  });
  const totalOverdueMinor = overdueRows.reduce((sum, r) => sum + r.amountOverdueMinor, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">รายงานผู้บริหาร/การเงิน</h1>
        <p className="mt-1 text-sm text-muted">
          ภาพรวมสถานะการเงินและความเสี่ยงหนี้แบบเรียลไทม์
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">เงินฝากรวม</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(savingsAgg._sum.balanceMinor ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">ทุนเรือนหุ้นรวม</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(shareAgg._sum.balanceMinor ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">เงินกู้คงค้าง</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(outstandingLoanAgg._sum.principalMinor ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-muted">สวัสดิการจ่ายไปแล้วสะสม</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatBaht(welfarePaidAgg._sum.amountMinor ?? 0)}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">องค์ประกอบสมาชิก</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {memberStatusCounts.map((row) => (
            <div key={row.status} className="rounded-md bg-surface-2 px-4 py-2.5">
              <p className="text-xs text-muted">{statusLabel[row.status] ?? row.status}</p>
              <p className="mt-0.5 text-lg font-bold text-ink">
                {row._count._all.toLocaleString("th-TH")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">สรุปหนี้ค้างชำระตามอายุหนี้ (Aging)</h2>
          <Link
            href="/back-office/reports/overdue"
            className="text-sm text-primary hover:underline"
          >
            ดูรายการทั้งหมด →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {bucketSummary.map((bucket) => (
            <div
              key={bucket.key}
              className={`rounded-md p-4 ${
                bucket.key === "d90plus" && bucket.count > 0
                  ? "bg-flag-soft"
                  : "bg-surface-2"
              }`}
            >
              <p
                className={`text-xs ${
                  bucket.key === "d90plus" && bucket.count > 0 ? "text-flag" : "text-muted"
                }`}
              >
                {bucket.label}
              </p>
              <p className="mt-1 text-base font-bold text-ink">
                {formatBaht(bucket.totalMinor)}
              </p>
              <p className="text-xs text-muted">{bucket.count.toLocaleString("th-TH")} งวด</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          รวมหนี้ค้างชำระทั้งสิ้น{" "}
          <span className="font-semibold text-ink">{formatBaht(totalOverdueMinor)}</span>
        </p>
      </section>

      <Link
        href="/back-office/reports/dividends"
        className="rounded-lg border border-line bg-surface p-5 hover:bg-surface-2"
      >
        <h2 className="text-sm font-bold text-ink">จำลองเงินปันผล / เงินเฉลี่ยคืน →</h2>
        <p className="mt-1 text-xs text-muted">
          คำนวณตัวอย่างการจัดสรรกำไรสุทธิตามสัดส่วนหุ้นและดอกเบี้ยที่ชำระ ก่อนเสนอที่ประชุมใหญ่
        </p>
      </Link>
    </div>
  );
}
