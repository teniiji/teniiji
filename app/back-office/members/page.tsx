import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateMemberForm } from "./create-member-form";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ปฏิบัติงาน",
  RETIRED: "เกษียณ",
  RESIGNED: "ลาออก",
};

export default async function MembersPage() {
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    include: { savingsAccounts: true, shareAccount: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ทะเบียนสมาชิก</h1>
        <p className="mt-1 text-sm text-muted">
          สมาชิกทั้งหมด {members.length.toLocaleString("th-TH")} คน
        </p>
      </div>

      <CreateMemberForm />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">รหัสสมาชิก</th>
              <th className="px-4 py-2.5 text-left font-medium">ชื่อ-นามสกุล</th>
              <th className="px-4 py-2.5 text-left font-medium">ต้นสังกัด</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-mono text-xs">{m.memberCode}</td>
                <td className="px-4 py-2.5">{m.fullName}</td>
                <td className="px-4 py-2.5 text-muted">{m.affiliation}</td>
                <td className="px-4 py-2.5">
                  {STATUS_LABEL[m.status] ?? m.status}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/back-office/members/${m.id}`}
                    className="text-primary hover:underline"
                  >
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  ยังไม่มีสมาชิกในระบบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
