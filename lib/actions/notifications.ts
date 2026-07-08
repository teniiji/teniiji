"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/session";
import { notifyMember } from "@/lib/notify";
import { formatBaht } from "@/lib/money";
import type { ActionState } from "@/lib/actions/members";
import type { NotificationChannel } from "@/generated/prisma/enums";

export async function createAnnouncementAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole([...STAFF_ROLES]);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channel = String(formData.get("channel") ?? "IN_APP") as NotificationChannel;

  if (!title || !body) return { error: "กรุณากรอกหัวข้อและเนื้อหาประกาศ" };

  await notifyMember({
    memberId: null,
    title,
    body,
    channel,
    createdByUserId: session.sub,
  });

  revalidatePath("/back-office/notifications");
  revalidatePath("/portal/notifications");
  return { success: "ส่งประกาศเรียบร้อยแล้ว" };
}

const REMINDER_WINDOW_DAYS = 7;

/**
 * แจ้งเตือนงวดเงินกู้ที่ใกล้ครบกำหนดชำระ (ภายใน 7 วัน) — สำคัญโดยเฉพาะสมาชิกเกษียณที่ไม่ได้หักผ่านเงินเดือน
 * กันแจ้งซ้ำงวดเดิมด้วยการฝัง marker "installment:<id>" ไว้ในเนื้อหาแล้วตรวจสอบก่อนสร้างใหม่
 */
export async function sendDueSoonRemindersAction(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  await requireRole(["STAFF_FINANCE", "MANAGER", "ADMIN"]);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const dueSoon = await prisma.loanInstallment.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: { gte: now, lte: windowEnd },
    },
    include: { loanContract: { include: { member: true } } },
  });

  let sentCount = 0;
  for (const inst of dueSoon) {
    const marker = `installment:${inst.id}`;
    const already = await prisma.notification.findFirst({
      where: { body: { contains: marker } },
    });
    if (already) continue;

    const amountDueMinor = inst.principalDueMinor + inst.interestDueMinor - inst.paidMinor;
    await notifyMember({
      memberId: inst.loanContract.memberId,
      title: "แจ้งเตือนงวดเงินกู้ใกล้ครบกำหนดชำระ",
      body: `งวดที่ ${inst.installmentNo} ครบกำหนดวันที่ ${inst.dueDate.toLocaleDateString("th-TH")} ยอด ${formatBaht(amountDueMinor)} กรุณาชำระภายในกำหนด (${marker})`,
    });
    sentCount += 1;
  }

  revalidatePath("/back-office/notifications");
  return {
    success:
      sentCount > 0
        ? `ส่งแจ้งเตือนงวดใกล้ครบกำหนด ${sentCount} รายการเรียบร้อยแล้ว`
        : "ไม่มีงวดที่ใกล้ครบกำหนดในช่วง 7 วันนี้ (หรือแจ้งเตือนไปแล้วทั้งหมด)",
  };
}
