"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/session";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(STAFF_ROLES);

  const memberCode = String(formData.get("memberCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const affiliation = String(formData.get("affiliation") ?? "").trim();
  const memberType = String(formData.get("memberType") ?? "ORDINARY") as
    | "ORDINARY"
    | "ASSOCIATE";

  if (!memberCode || !fullName || !nationalId || !affiliation) {
    return { error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          memberCode,
          fullName,
          nationalId,
          affiliation,
          memberType,
        },
      });

      await tx.savingsAccount.create({
        data: {
          memberId: member.id,
          accountNumber: `SA-${memberCode}`,
          type: "SAVINGS",
          interestRateBps: 150, // 1.5% ต่อปี
        },
      });

      await tx.shareAccount.create({
        data: {
          memberId: member.id,
          monthlyContributionMinor: 50000, // 500 บาท/เดือน (ค่าเริ่มต้น)
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.sub,
          action: "CREATE_MEMBER",
          entityType: "Member",
          entityId: member.id,
          after: JSON.stringify({ memberCode, fullName, memberType }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique")) {
      return { error: "รหัสสมาชิกหรือเลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว" };
    }
    return { error: "ไม่สามารถสร้างสมาชิกได้ กรุณาลองใหม่" };
  }

  revalidatePath("/back-office/members");
  return { success: `สร้างสมาชิก ${fullName} เรียบร้อยแล้ว` };
}
