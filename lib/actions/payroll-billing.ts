"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, FINANCE_ROLES } from "@/lib/session";
import { notifyMember } from "@/lib/notify";
import { formatBaht } from "@/lib/money";
import type { ActionState } from "@/lib/actions/members";

function parsePeriod(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("รูปแบบงวดไม่ถูกต้อง (ต้องเป็น YYYY-MM)");
  }
  const [year, month] = period.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  return { monthStart, monthEnd };
}

/**
 * สร้างรายการ "เรียกเก็บ" ประจำเดือน: รวมค่าหุ้น + เงินฝากภาคบังคับ + งวดเงินกู้ที่ครบกำหนด
 * ของสมาชิกที่ยังปฏิบัติงานอยู่ (ACTIVE) ทุกคน เพื่อส่งให้ต้นสังกัดหักผ่านเงินเดือน
 * ทำซ้ำในงวดเดียวกันไม่ได้ (กันสร้างรายการเรียกเก็บซ้ำ)
 */
export async function generateMonthlyBillingAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ROLES);
  const period = String(formData.get("period") ?? "").trim();

  let monthStart: Date;
  let monthEnd: Date;
  try {
    ({ monthStart, monthEnd } = parsePeriod(period));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "งวดไม่ถูกต้อง" };
  }

  const existing = await prisma.payrollBillingRun.findUnique({
    where: { period },
  });
  if (existing) {
    return { error: `สร้างรายการเรียกเก็บงวด ${period} ไปแล้ว ไม่สามารถทำซ้ำได้` };
  }

  const members = await prisma.member.findMany({
    where: { status: "ACTIVE" },
    include: {
      shareAccount: true,
      savingsAccounts: true,
      loanContracts: {
        where: { status: "DISBURSED" },
        include: {
          installments: {
            where: {
              dueDate: { gte: monthStart, lt: monthEnd },
              status: { not: "PAID" },
            },
          },
        },
      },
    },
  });

  const items = members
    .map((member) => {
      const shareDueMinor = member.shareAccount?.monthlyContributionMinor ?? 0;
      const savingsDueMinor = member.savingsAccounts.reduce(
        (sum, acc) => sum + acc.mandatoryMonthlyMinor,
        0
      );
      const loanDueMinor = member.loanContracts.reduce(
        (sum, loan) =>
          sum +
          loan.installments.reduce(
            (s, inst) =>
              s + (inst.principalDueMinor + inst.interestDueMinor - inst.paidMinor),
            0
          ),
        0
      );
      const totalDueMinor = shareDueMinor + savingsDueMinor + loanDueMinor;
      return { memberId: member.id, shareDueMinor, savingsDueMinor, loanDueMinor, totalDueMinor };
    })
    .filter((item) => item.totalDueMinor > 0);

  if (items.length === 0) {
    return { error: "ไม่มีรายการที่ต้องเรียกเก็บสำหรับงวดนี้" };
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollBillingRun.create({
      data: { period, generatedByUserId: session.sub },
    });

    await tx.payrollDeductionRecord.createMany({
      data: items.map((item) => ({ ...item, billingRunId: created.id })),
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "GENERATE_MONTHLY_BILLING",
        entityType: "PayrollBillingRun",
        entityId: created.id,
        after: JSON.stringify({ period, memberCount: items.length }),
      },
    });

    return created;
  });

  // แจ้งยอดหักเงินเดือนประจำเดือนให้สมาชิกแต่ละคนที่อยู่ในรายการทราบ
  await Promise.all(
    items.map((item) =>
      notifyMember({
        memberId: item.memberId,
        title: `แจ้งยอดหักเงินเดือนงวด ${period}`,
        body: `หุ้น ${formatBaht(item.shareDueMinor)} + เงินฝากภาคบังคับ ${formatBaht(item.savingsDueMinor)} + งวดเงินกู้ ${formatBaht(item.loanDueMinor)} รวม ${formatBaht(item.totalDueMinor)} จะถูกส่งให้ต้นสังกัดหักผ่านเงินเดือน`,
      })
    )
  );

  redirect(`/back-office/payroll-billing/${run.id}`);
}
