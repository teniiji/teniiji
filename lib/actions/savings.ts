"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { parseBahtInput } from "@/lib/money";
import type { ActionState } from "@/lib/actions/members";

const FINANCE_ROLES = ["STAFF_FINANCE", "MANAGER", "ADMIN"] as const;

export async function depositAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole([...FINANCE_ROLES]);
  const savingsAccountId = String(formData.get("savingsAccountId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  let amountMinor: number;
  try {
    amountMinor = parseBahtInput(formData.get("amount"));
  } catch {
    return { error: "จำนวนเงินฝากไม่ถูกต้อง" };
  }

  const account = await prisma.savingsAccount.findUnique({
    where: { id: savingsAccountId },
  });
  if (!account || account.memberId !== memberId) {
    return { error: "ไม่พบบัญชีเงินฝากนี้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.savingsAccount.update({
      where: { id: savingsAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });

    const txn = await tx.transaction.create({
      data: {
        type: "DEPOSIT",
        amountMinor,
        note,
        memberId,
        savingsAccountId,
        createdByUserId: session.sub,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "DEPOSIT",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ savingsAccountId, amountMinor }),
      },
    });
  });

  revalidatePath(`/back-office/members/${memberId}`);
  return { success: "บันทึกการฝากเงินเรียบร้อยแล้ว" };
}

export async function withdrawAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole([...FINANCE_ROLES]);
  const savingsAccountId = String(formData.get("savingsAccountId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  let amountMinor: number;
  try {
    amountMinor = parseBahtInput(formData.get("amount"));
  } catch {
    return { error: "จำนวนเงินถอนไม่ถูกต้อง" };
  }

  const account = await prisma.savingsAccount.findUnique({
    where: { id: savingsAccountId },
  });
  if (!account || account.memberId !== memberId) {
    return { error: "ไม่พบบัญชีเงินฝากนี้" };
  }
  if (account.balanceMinor < amountMinor) {
    return { error: "ยอดเงินคงเหลือไม่เพียงพอ" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.savingsAccount.update({
      where: { id: savingsAccountId },
      data: { balanceMinor: { decrement: amountMinor } },
    });

    const txn = await tx.transaction.create({
      data: {
        type: "WITHDRAWAL",
        amountMinor,
        note,
        memberId,
        savingsAccountId,
        createdByUserId: session.sub,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "WITHDRAWAL",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ savingsAccountId, amountMinor }),
      },
    });
  });

  revalidatePath(`/back-office/members/${memberId}`);
  return { success: "บันทึกการถอนเงินเรียบร้อยแล้ว" };
}

export async function runInterestAccrualAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(["MANAGER", "ADMIN"]);
  const period = String(formData.get("period") ?? "").trim(); // "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { error: "รูปแบบงวดไม่ถูกต้อง (ต้องเป็น YYYY-MM)" };
  }

  const marker = `INTEREST:${period}`;
  const already = await prisma.transaction.findFirst({
    where: { type: "INTEREST_ACCRUAL", note: marker },
  });
  if (already) {
    return { error: `ประมวลผลดอกเบี้ยงวด ${period} ไปแล้ว ไม่สามารถทำซ้ำได้` };
  }

  const accounts = await prisma.savingsAccount.findMany();
  let count = 0;

  await prisma.$transaction(async (tx) => {
    for (const account of accounts) {
      const monthlyInterest = Math.round(
        (account.balanceMinor * account.interestRateBps) / 10000 / 12
      );
      if (monthlyInterest <= 0) continue;

      await tx.savingsAccount.update({
        where: { id: account.id },
        data: { balanceMinor: { increment: monthlyInterest } },
      });

      await tx.transaction.create({
        data: {
          type: "INTEREST_ACCRUAL",
          amountMinor: monthlyInterest,
          note: marker,
          memberId: account.memberId,
          savingsAccountId: account.id,
          createdByUserId: session.sub,
        },
      });
      count += 1;
    }

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "RUN_INTEREST_ACCRUAL",
        entityType: "Period",
        entityId: period,
        after: JSON.stringify({ accountsCredited: count }),
      },
    });
  });

  revalidatePath("/back-office");
  return { success: `ประมวลผลดอกเบี้ยงวด ${period} เรียบร้อย (${count} บัญชี)` };
}
