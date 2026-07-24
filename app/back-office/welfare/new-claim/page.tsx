import { prisma } from "@/lib/prisma";
import { NewClaimForm } from "./new-claim-form";

export default async function NewWelfareClaimPage() {
  const [members, funds] = await Promise.all([
    prisma.member.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, memberCode: true, fullName: true },
    }),
    prisma.welfareFund.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ยื่นคำขอสวัสดิการแทนสมาชิก</h1>
        <p className="mt-1 text-sm text-muted">
          ระบบจะตรวจสอบสิทธิ์ของสมาชิกอัตโนมัติ (สถานะ, อายุสมาชิกภาพ, หนี้ค้างชำระ)
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <NewClaimForm members={members} funds={funds} />
      </div>
    </div>
  );
}
