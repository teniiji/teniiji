"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { parseBahtInput } from "@/lib/money";
import type { ActionState } from "@/lib/actions/members";

export async function recordShareContributionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(["STAFF_FINANCE", "MANAGER", "ADMIN"]);
  const shareAccountId = String(formData.get("shareAccountId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  let amountMinor: number;
  try {
    amountMinor = parseBahtInput(formData.get("amount"));
  } catch {
    return { error: "จำนวนเงินซื้อหุ้นไม่ถูกต้อง" };
  }

  const account = await prisma.shareAccount.findUnique({
    where: { id: shareAccountId },
  });
  if (!account || account.memberId !== memberId) {
    return { error: "ไม่พบบัญชีหุ้นนี้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.shareAccount.update({
      where: { id: shareAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });

    const txn = await tx.transaction.create({
      data: {
        type: "SHARE_CONTRIBUTION",
        amountMinor,
        memberId,
        shareAccountId,
        createdByUserId: session.sub,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "SHARE_CONTRIBUTION",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ shareAccountId, amountMinor }),
      },
    });
  });

  revalidatePath(`/back-office/members/${memberId}`);
  return { success: "บันทึกการซื้อหุ้นเรียบร้อยแล้ว" };
}
