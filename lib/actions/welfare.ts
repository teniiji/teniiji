"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { parseBahtInput } from "@/lib/money";
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
  await requireRole(["MANAGER", "ADMIN"]);

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
  await requireRole(["STAFF_FINANCE", "STAFF_LOAN", "MANAGER", "ADMIN"]);

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
  const session = await requireRole(["MANAGER", "ADMIN"]);
  const welfareClaimId = String(formData.get("welfareClaimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim() || null;

  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { error: "การตัดสินใจไม่ถูกต้อง" };
  }

  const claim = await prisma.welfareClaim.findUnique({ where: { id: welfareClaimId } });
  if (!claim || claim.status !== "SUBMITTED") {
    return { error: "คำขอนี้ไม่อยู่ในสถานะที่พิจารณาได้" };
  }
  if (decision === "REJECT" && !rejectionReason) {
    return { error: "กรุณาระบุเหตุผลการปฏิเสธ" };
  }

  await prisma.$transaction(async (tx) => {
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
  const session = await requireRole(["STAFF_FINANCE", "ADMIN"]);
  const welfareClaimId = String(formData.get("welfareClaimId") ?? "");

  const claim = await prisma.welfareClaim.findUnique({ where: { id: welfareClaimId } });
  if (!claim || claim.status !== "APPROVED") {
    return { error: "คำขอนี้ไม่อยู่ในสถานะที่จ่ายเงินได้" };
  }

  const savingsAccount = await prisma.savingsAccount.findFirst({
    where: { memberId: claim.memberId, type: "SAVINGS" },
  });
  if (!savingsAccount) {
    return { error: "สมาชิกยังไม่มีบัญชีเงินฝากออมทรัพย์สำหรับรับเงินสวัสดิการ" };
  }

  await prisma.$transaction(async (tx) => {
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
  });

  revalidatePath(`/back-office/welfare/claims/${welfareClaimId}`);
  return { success: "จ่ายเงินสวัสดิการเรียบร้อยแล้ว เงินเข้าบัญชีเงินฝากออมทรัพย์ของสมาชิก" };
}
