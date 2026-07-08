import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function PortalNotificationsPage() {
  const session = await getSession();
  if (!session?.memberId) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: {
      status: "SENT",
      OR: [{ memberId: session.memberId }, { memberId: null }],
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">การแจ้งเตือน</h1>
        <p className="mt-1 text-sm text-muted">
          ข้อความและประกาศจากสหกรณ์ {notifications.length.toLocaleString("th-TH")} รายการ
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{n.title}</p>
              {n.memberId === null && (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                  ประกาศทั่วไป
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted">{n.body}</p>
            <p className="mt-2 text-xs text-muted">
              {n.createdAt.toLocaleString("th-TH")}
            </p>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">
            ยังไม่มีการแจ้งเตือน
          </p>
        )}
      </div>
    </div>
  );
}
