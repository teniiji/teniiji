import { prisma } from "@/lib/prisma";
import type { NotificationChannel } from "@/generated/prisma/enums";

/**
 * บันทึกการแจ้งเตือนถึงสมาชิก — IN_APP ใช้งานได้จริงทันที (แสดงในกล่องข้อความพอร์ทัลสมาชิก)
 * ส่วน LINE/SMS/EMAIL ยังไม่ได้เชื่อมต่อผู้ให้บริการจริงใน MVP นี้ (ไม่มี credential) จึงบันทึกไว้เป็น PENDING
 * ตั้งใจแยกเป็น side effect ต่างหากจาก transaction ทางการเงินหลัก — ถ้าการแจ้งเตือนล้มเหลวไม่ควรทำให้
 * ธุรกรรมทางการเงินที่สำเร็จแล้วต้อง rollback ไปด้วย
 */
export async function notifyMember(params: {
  memberId: string | null;
  title: string;
  body: string;
  channel?: NotificationChannel;
  createdByUserId?: string | null;
}) {
  const channel = params.channel ?? "IN_APP";
  const status = channel === "IN_APP" ? "SENT" : "PENDING";

  try {
    await prisma.notification.create({
      data: {
        memberId: params.memberId,
        title: params.title,
        body: params.body,
        channel,
        status,
        createdByUserId: params.createdByUserId ?? null,
      },
    });
  } catch (e) {
    console.error("notifyMember failed:", e);
  }
}
