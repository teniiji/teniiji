import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AnnouncementForm } from "./announcement-form";
import { ReminderButton } from "./reminder-button";

const CHANNEL_LABEL: Record<string, string> = {
  IN_APP: "ในแอป",
  LINE: "LINE OA",
  SMS: "SMS",
  EMAIL: "อีเมล",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "ส่งแล้ว",
  PENDING: "รอเชื่อมต่อผู้ให้บริการ",
  FAILED: "ส่งไม่สำเร็จ",
};

const STATUS_BADGE: Record<string, string> = {
  SENT: "bg-primary-soft text-primary-ink",
  PENDING: "bg-accent-soft text-accent",
  FAILED: "bg-flag-soft text-flag",
};

export default async function NotificationsPage() {
  const session = await getSession();

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { member: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">แจ้งเตือน/สื่อสารกับสมาชิก</h1>
        <p className="mt-1 text-sm text-muted">
          ช่องทางหลักคือในแอป (พอร์ทัลสมาชิก) — LINE OA/SMS/อีเมลยังเป็น stub รอเชื่อมต่อผู้ให้บริการจริง
        </p>
      </div>

      <AnnouncementForm />
      {(session?.role === "STAFF_FINANCE" ||
        session?.role === "MANAGER" ||
        session?.role === "ADMIN") && <ReminderButton />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">หัวข้อ</th>
              <th className="px-4 py-2.5 text-left font-medium">ถึง</th>
              <th className="px-4 py-2.5 text-left font-medium">ช่องทาง</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-left font-medium">เวลา</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id} className="border-t border-line align-top">
                <td className="max-w-xs px-4 py-2.5">
                  <p className="font-medium text-ink">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {n.member ? n.member.fullName : "ประกาศทั่วไป (ทุกคน)"}
                </td>
                <td className="px-4 py-2.5">{CHANNEL_LABEL[n.channel] ?? n.channel}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[n.status] ?? ""}`}
                  >
                    {STATUS_LABEL[n.status] ?? n.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {n.createdAt.toLocaleString("th-TH")}
                </td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีการแจ้งเตือน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
