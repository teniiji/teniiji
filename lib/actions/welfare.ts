"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  STAFF_ROLES,
  FINANCE_ADMIN_ROLES,
  MANAGER_ADMIN_ROLES,
} from "@/lib/session";
import { parseBahtInput, formatBaht } from "@/lib/money";
import { notifyMember } from "@/lib/notify";
import type { ActionState } from "@/lib/actions/members";

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** ตรวจสอบสิทธิ์: สมาชิกต้องปฏิบัติงานอยู่, อายุสมาชิกภาพครบตามกองทุนกำหนด, และไม่มีหนี้ค้างชำระเกินกำหนด */
async function checkEligibility(
  memberId: string,
  welfareFundId: string
): Promise<string | null> {
  const [member, fund] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      include: { loanContracts: { include: { installments: true } } },
    }),
    prisma.welfareFund.findUnique({ where: { id: welfareFundId } }),
  ]);

  if (!member) return "ไม่พบสมาชิกนี้";
  if (!fund || !fund.active) return "ไม่พบกองทุนนี้ หรือกองทุนปิดรับคำขอแล้ว";
  if (member.status !== "ACTIVE") return "สมาชิกต้องมีสถานะปฏิบัติงานอยู่จึงจะมีสิทธิ์รับสวัสดิการ";

  const membershipMonths = monthsBetween(member.createdAt, new Date());
  if (membershipMonths < fund.minMembershipMonths) {
    return `ต้องเป็นสมาชิกมาแล้วอย่างน้อย ${fund.minMembershipMonths} เดือน (ปัจจุบัน ${membershipMonths} เดือน)`;
  }

  const overdueCutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  const hasOverdue = member.loanContracts.some((loan) =>
    loan.installments.some((inst) => inst.status !== "PAID" && inst.dueDate < overdueCutoff)
  );
  if (hasOverdue) {
    return "มีงวดเงินกู้ค้างชำระเกินกำหนด ไม่สามารถยื่นขอสวัสดิการได้จนกว่าจะชำระให้เป็นปัจจุบัน";
  }

  return null;
}

export async function createWelfareFundAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(MANAGER_ADMIN_ROLES);

  const type = String(formData.get("type") ?? "FUNERAL") as
    | "FUNERAL"
    | "EDUCATION"
    | "MEDICAL";
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const minMembershipMonths = Number(formData.get("minMembershipMonths") ?? 0);

  if (!name) return { error: "กรุณากรอกชื่อกองทุน" };

  let benefitAmountMinor: number;
  try {
    benefitAmountMinor = parseBahtInput(formData.get("benefitAmount"));
  } catch {
    return { error: "จำนวนเงินสวัสดิการไม่ถูกต้อง" };
  }
  if (!Number.isInteger(minMembershipMonths) || minMembershipMonths < 0) {
    return { error: "อายุสมาชิกภาพขั้นต่ำไม่ถูกต้อง" };
  }

  await prisma.welfareFund.create({
    data: { type, name, description, benefitAmountMinor, minMembershipMonths },
  });

  revalidatePath("/back-office/welfare");
  return { success: `สร้างกองทุน "${name}" เรียบร้อยแล้ว` };
}

/** เจ้าหน้าที่ยื่นคำขอแทนสมาชิก */
export async function createWelfareClaimAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(STAFF_ROLES);

  const memberId = String(formData.get("memberId") ?? "");
  const welfareFundId = String(formData.get("welfareFundId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!memberId || !welfareFundId || !reason) {
    return { error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  const ineligibleReason = await checkEligibility(memberId, welfareFundId);
  if (ineligibleReason) return { error: ineligibleReason };

  const fund = await prisma.welfareFund.findUnique({ where: { id: welfareFundId } });
  if (!fund) return { error: "ไม่พบกองทุนนี้" };

  await prisma.welfareClaim.create({
    data: {
      memberId,
      welfareFundId,
      reason,
      requestedAmountMinor: fund.benefitAmountMinor,
    },
  });

  revalidatePath("/back-office/welfare");
  return { success: "ยื่นคำขอสวัสดิการเรียบร้อยแล้ว รอพิจารณา" };
}

/** สมาชิกยื่นคำขอด้วยตนเองผ่านพอร์ทัล */
export async function applyWelfareClaimAsMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(["MEMBER"]);
  if (!session.memberId) return { error: "บัญชีนี้ไม่ได้ผูกกับสมาชิก" };

  const welfareFundId = String(formData.get("welfareFundId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!welfareFundId || !reason) {
    return { error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  const ineligibleReason = await checkEligibility(session.memberId, welfareFundId);
  if (ineligibleReason) return { error: ineligibleReason };

  const fund = await prisma.welfareFund.findUnique({ where: { id: welfareFundId } });
  if (!fund) return { error: "ไม่พบกองทุนนี้" };

  await prisma.welfareClaim.create({
    data: {
      memberId: session.memberId,
      welfareFundId,
      reason,
      requestedAmountMinor: fund.benefitAmountMinor,
    },
  });

  revalidatePath("/portal/welfare");
  return { success: "ยื่นคำขอสวัสดิการเรียบร้อยแล้ว รอเจ้าหน้าที่พิจารณา" };
}

export async function decideWelfareClaimAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(MANAGER_ADMIN_ROLES);
  const welfareClaimId = String(formData.get("welfareClaimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim() || null;

  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { error: "การตัดสินใจไม่ถูกต้อง" };
  }
  if (decision === "REJECT" && !rejectionReason) {
    return { error: "กรุณาระบุเหตุผลการปฏิเสธ" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.welfareClaim.findUnique({ where: { id: welfareClaimId } });
    if (!claim || claim.status !== "SUBMITTED") {
      return { error: "คำขอนี้ไม่อยู่ในสถานะที่พิจารณาได้" } satisfies ActionState;
    }

    await tx.welfareClaim.update({
      where: { id: welfareClaimId },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        rejectionReason: decision === "REJECT" ? rejectionReason : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: decision === "APPROVE" ? "APPROVE_WELFARE_CLAIM" : "REJECT_WELFARE_CLAIM",
        entityType: "WelfareClaim",
        entityId: welfareClaimId,
      },
    });

    return { memberId: claim.memberId };
  });

  if ("error" in result) return result;
  const claim = result;

  await notifyMember({
    memberId: claim.memberId,
    title:
      decision === "APPROVE" ? "คำขอสวัสดิการได้รับการอนุมัติ" : "คำขอสวัสดิการไม่ได้รับการอนุมัติ",
    body:
      decision === "APPROVE"
        ? "คำขอรับสวัสดิการของท่านได้รับการอนุมัติแล้ว รอเจ้าหน้าที่การเงินจ่ายเงินเข้าบัญชีเงินฝากของท่าน"
        : `คำขอรับสวัสดิการของท่านไม่ได้รับการอนุมัติ เหตุผล: ${rejectionReason}`,
  });

  revalidatePath(`/back-office/welfare/claims/${welfareClaimId}`);
  return {
    success: decision === "APPROVE" ? "อนุมัติคำขอสวัสดิการเรียบร้อยแล้ว" : "ปฏิเสธคำขอสวัสดิการแล้ว",
  };
}

export async function payWelfareClaimAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ADMIN_ROLES);
  const welfareClaimId = String(formData.get("welfareClaimId") ?? "");

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.welfareClaim.findUnique({ where: { id: welfareClaimId } });
    if (!claim || claim.status !== "APPROVED") {
      return { error: "คำขอนี้ไม่อยู่ในสถานะที่จ่ายเงินได้" } satisfies ActionState;
    }

    const savingsAccount = await tx.savingsAccount.findFirst({
      where: { memberId: claim.memberId, type: "SAVINGS" },
    });
    if (!savingsAccount) {
      return { error: "สมาชิกยังไม่มีบัญชีเงินฝากออมทรัพย์สำหรับรับเงินสวัสดิการ" } satisfies ActionState;
    }

    await tx.welfareClaim.update({
      where: { id: welfareClaimId },
      data: { status: "PAID", paidAt: new Date() },
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: { balanceMinor: { increment: claim.requestedAmountMinor } },
    });

    const txn = await tx.transaction.create({
      data: {
        type: "WELFARE_PAYOUT",
        amountMinor: claim.requestedAmountMinor,
        memberId: claim.memberId,
        savingsAccountId: savingsAccount.id,
        welfareClaimId,
        createdByUserId: session.sub,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "PAY_WELFARE_CLAIM",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ welfareClaimId, amountMinor: claim.requestedAmountMinor }),
      },
    });

    return { memberId: claim.memberId, amountMinor: claim.requestedAmountMinor };
  });

  if ("error" in result) return result;

  await notifyMember({
    memberId: result.memberId,
    title: "จ่ายเงินสวัสดิการเรียบร้อยแล้ว",
    body: `เงินสวัสดิการจำนวน ${formatBaht(result.amountMinor)} ได้เข้าบัญชีเงินฝากออมทรัพย์ของท่านแล้ว`,
  });

  revalidatePath(`/back-office/welfare/claims/${welfareClaimId}`);
  return { success: "จ่ายเงินสวัสดิการเรียบร้อยแล้ว เงินเข้าบัญชีเงินฝากออมทรัพย์ของสมาชิก" };
}
