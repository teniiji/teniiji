"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  LOAN_ROLES,
  FINANCE_ROLES,
  FINANCE_ADMIN_ROLES,
  MANAGER_ADMIN_ROLES,
} from "@/lib/session";
import { parseBahtInput } from "@/lib/money";
import { buildAmortizationSchedule } from "@/lib/loan-schedule";
import { notifyMember } from "@/lib/notify";
import type { ActionState } from "@/lib/actions/members";
import type { LoanType } from "@/generated/prisma/enums";

function parseLoanForm(formData: FormData) {
  const type = String(formData.get("type") ?? "ORDINARY") as LoanType;
  const principalMinor = parseBahtInput(formData.get("principal"));
  const interestRatePercent = Number(formData.get("interestRatePercent"));
  const termMonths = Number(formData.get("termMonths"));
  const collateralNote =
    String(formData.get("collateralNote") ?? "").trim() || null;

  if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0) {
    throw new Error("อัตราดอกเบี้ยไม่ถูกต้อง");
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0 || termMonths > 240) {
    throw new Error("ระยะเวลากู้ไม่ถูกต้อง");
  }

  return {
    type,
    principalMinor,
    interestRateBps: Math.round(interestRatePercent * 100),
    termMonths,
    collateralNote,
  };
}

/** เจ้าหน้าที่สินเชื่อสร้างคำขอกู้แทนสมาชิก (พร้อมผู้ค้ำประกันได้ 1 คน สำหรับ MVP) */
export async function createLoanContractAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(LOAN_ROLES);
  const memberId = String(formData.get("memberId") ?? "");

  let parsed: ReturnType<typeof parseLoanForm>;
  try {
    parsed = parseLoanForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ข้อมูลเงินกู้ไม่ถูกต้อง" };
  }

  const guarantorMemberCode = String(
    formData.get("guarantorMemberCode") ?? ""
  ).trim();
  const rawGuaranteedAmount = String(formData.get("guaranteedAmount") ?? "").trim();

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { error: "ไม่พบสมาชิกนี้" };

  let guarantor = null;
  let guaranteedAmountMinor = parsed.principalMinor;
  if (guarantorMemberCode) {
    guarantor = await prisma.member.findUnique({
      where: { memberCode: guarantorMemberCode },
    });
    if (!guarantor) {
      return { error: "ไม่พบรหัสสมาชิกผู้ค้ำประกัน" };
    }
    if (guarantor.id === memberId) {
      return { error: "สมาชิกไม่สามารถค้ำประกันเงินกู้ของตนเองได้" };
    }
    // "0" หรือค่าว่างถือว่าไม่ได้ระบุ ใช้วงเงินกู้เต็มจำนวนเป็นค่าเริ่มต้น
    if (rawGuaranteedAmount && Number(rawGuaranteedAmount) > 0) {
      try {
        guaranteedAmountMinor = parseBahtInput(rawGuaranteedAmount);
      } catch {
        return { error: "วงเงินค้ำประกันไม่ถูกต้อง" };
      }
    }
  }

  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loanContract.create({
      data: {
        ...parsed,
        memberId,
        status: "SUBMITTED",
      },
    });

    if (guarantor) {
      await tx.loanGuarantor.create({
        data: {
          loanContractId: created.id,
          memberId: guarantor.id,
          guaranteedAmountMinor,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "CREATE_LOAN",
        entityType: "LoanContract",
        entityId: created.id,
        after: JSON.stringify(parsed),
      },
    });

    return created;
  });

  revalidatePath("/back-office/loans");
  redirect(`/back-office/loans/${loan.id}`);
}

/** สมาชิกยื่นคำขอกู้ด้วยตนเองผ่านพอร์ทัล (ยังไม่มีผู้ค้ำ ต้องให้เจ้าหน้าที่เพิ่มภายหลัง) */
export async function applyLoanAsMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(["MEMBER"]);
  if (!session.memberId) {
    return { error: "บัญชีนี้ไม่ได้ผูกกับสมาชิก" };
  }

  let parsed: ReturnType<typeof parseLoanForm>;
  try {
    parsed = parseLoanForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ข้อมูลเงินกู้ไม่ถูกต้อง" };
  }

  await prisma.loanContract.create({
    data: {
      ...parsed,
      memberId: session.memberId,
      status: "SUBMITTED",
    },
  });

  revalidatePath("/portal");
  return { success: "ส่งคำขอกู้เรียบร้อยแล้ว รอเจ้าหน้าที่พิจารณา" };
}

/** ผู้จัดการ/แอดมินอนุมัติ (maker-checker: แยกจากเจ้าหน้าที่สินเชื่อที่สร้างคำขอ) */
export async function approveLoanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(MANAGER_ADMIN_ROLES);
  const loanContractId = String(formData.get("loanContractId") ?? "");

  const loan = await prisma.loanContract.findUnique({
    where: { id: loanContractId },
  });
  if (!loan || loan.status !== "SUBMITTED") {
    return { error: "คำขอกู้นี้ไม่อยู่ในสถานะที่อนุมัติได้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loanContract.update({
      where: { id: loanContractId },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "APPROVE_LOAN",
        entityType: "LoanContract",
        entityId: loanContractId,
      },
    });
  });

  await notifyMember({
    memberId: loan.memberId,
    title: "คำขอกู้ได้รับการอนุมัติแล้ว",
    body: "คำขอเงินกู้ของท่านได้รับการอนุมัติแล้ว รอเจ้าหน้าที่การเงินเบิกจ่ายเงินเข้าบัญชีเงินฝากของท่าน",
  });

  revalidatePath(`/back-office/loans/${loanContractId}`);
  return { success: "อนุมัติเงินกู้เรียบร้อยแล้ว" };
}

export async function rejectLoanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(LOAN_ROLES);
  const loanContractId = String(formData.get("loanContractId") ?? "");

  const loan = await prisma.loanContract.findUnique({
    where: { id: loanContractId },
  });
  if (!loan || loan.status !== "SUBMITTED") {
    return { error: "คำขอกู้นี้ไม่อยู่ในสถานะที่ปฏิเสธได้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loanContract.update({
      where: { id: loanContractId },
      data: { status: "REJECTED" },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "REJECT_LOAN",
        entityType: "LoanContract",
        entityId: loanContractId,
      },
    });
  });

  await notifyMember({
    memberId: loan.memberId,
    title: "คำขอกู้ไม่ได้รับการอนุมัติ",
    body: "คำขอเงินกู้ของท่านไม่ได้รับการอนุมัติในครั้งนี้ กรุณาติดต่อเจ้าหน้าที่สินเชื่อหากต้องการรายละเอียดเพิ่มเติม",
  });

  revalidatePath(`/back-office/loans/${loanContractId}`);
  return { success: "ปฏิเสธคำขอกู้แล้ว" };
}

/** เบิกจ่าย: สร้างตารางผ่อนชำระ + เข้าเงินในบัญชีเงินฝากหลักของสมาชิก */
export async function disburseLoanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ADMIN_ROLES);
  const loanContractId = String(formData.get("loanContractId") ?? "");

  const loan = await prisma.loanContract.findUnique({
    where: { id: loanContractId },
  });
  if (!loan || loan.status !== "APPROVED") {
    return { error: "คำขอกู้นี้ไม่อยู่ในสถานะที่เบิกจ่ายได้" };
  }

  const savingsAccount = await prisma.savingsAccount.findFirst({
    where: { memberId: loan.memberId, type: "SAVINGS" },
  });
  if (!savingsAccount) {
    return { error: "สมาชิกยังไม่มีบัญชีเงินฝากออมทรัพย์สำหรับรับเงินกู้" };
  }

  const disbursedAt = new Date();
  const schedule = buildAmortizationSchedule({
    principalMinor: loan.principalMinor,
    interestRateBps: loan.interestRateBps,
    termMonths: loan.termMonths,
    startDate: disbursedAt,
  });

  await prisma.$transaction(async (tx) => {
    await tx.loanContract.update({
      where: { id: loanContractId },
      data: { status: "DISBURSED", disbursedAt },
    });

    await tx.loanInstallment.createMany({
      data: schedule.map((row) => ({
        loanContractId,
        installmentNo: row.installmentNo,
        dueDate: row.dueDate,
        principalDueMinor: row.principalDueMinor,
        interestDueMinor: row.interestDueMinor,
      })),
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: { balanceMinor: { increment: loan.principalMinor } },
    });

    await tx.transaction.create({
      data: {
        type: "LOAN_DISBURSEMENT",
        amountMinor: loan.principalMinor,
        memberId: loan.memberId,
        savingsAccountId: savingsAccount.id,
        loanContractId,
        createdByUserId: session.sub,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "DISBURSE_LOAN",
        entityType: "LoanContract",
        entityId: loanContractId,
        after: JSON.stringify({ installments: schedule.length }),
      },
    });
  });

  await notifyMember({
    memberId: loan.memberId,
    title: "เบิกจ่ายเงินกู้เรียบร้อยแล้ว",
    body: `เงินกู้จำนวน ${schedule.length} งวด ได้เข้าบัญชีเงินฝากออมทรัพย์ของท่านแล้ว งวดแรกครบกำหนดวันที่ ${schedule[0]?.dueDate.toLocaleDateString("th-TH")}`,
  });

  revalidatePath(`/back-office/loans/${loanContractId}`);
  return { success: "เบิกจ่ายเงินกู้และสร้างตารางผ่อนชำระเรียบร้อยแล้ว" };
}

export async function recordLoanPaymentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ROLES);
  const loanInstallmentId = String(formData.get("loanInstallmentId") ?? "");

  let amountMinor: number;
  try {
    amountMinor = parseBahtInput(formData.get("amount"));
  } catch {
    return { error: "จำนวนเงินชำระไม่ถูกต้อง" };
  }

  // อ่านสถานะงวดล่าสุด "ภายใน" transaction เดียวกับที่เขียน (ไม่ใช่ก่อนหน้า) และใช้ increment
  // แทนการคำนวณยอดใหม่จากค่าที่อ่านมาก่อน — กันปัญหา lost update เมื่อมีการบันทึกชำระพร้อมกัน
  const result = await prisma.$transaction(async (tx) => {
    const installment = await tx.loanInstallment.findUnique({
      where: { id: loanInstallmentId },
      include: { loanContract: true },
    });
    if (!installment) return { error: "ไม่พบงวดชำระนี้" } satisfies ActionState;
    if (installment.status === "PAID") {
      return { error: "งวดนี้ชำระครบแล้ว" } satisfies ActionState;
    }

    const newPaid = installment.paidMinor + amountMinor;
    const totalDue = installment.principalDueMinor + installment.interestDueMinor;
    const status = newPaid >= totalDue ? "PAID" : "PARTIAL";

    await tx.loanInstallment.update({
      where: { id: loanInstallmentId },
      data: {
        paidMinor: { increment: amountMinor },
        status,
        paidAt: status === "PAID" ? new Date() : installment.paidAt,
      },
    });

    const txn = await tx.transaction.create({
      data: {
        type: "LOAN_PAYMENT",
        amountMinor,
        memberId: installment.loanContract.memberId,
        loanContractId: installment.loanContractId,
        loanInstallmentId,
        createdByUserId: session.sub,
      },
    });

    const allInstallments = await tx.loanInstallment.findMany({
      where: { loanContractId: installment.loanContractId },
    });
    const allPaid = allInstallments.every((i) => i.status === "PAID");
    if (allPaid) {
      await tx.loanContract.update({
        where: { id: installment.loanContractId },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "RECORD_LOAN_PAYMENT",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ loanInstallmentId, amountMinor }),
      },
    });

    return { loanContractId: installment.loanContractId };
  });

  if ("error" in result) return result;

  revalidatePath(`/back-office/loans/${result.loanContractId}`);
  return { success: "บันทึกการชำระงวดเรียบร้อยแล้ว" };
}
