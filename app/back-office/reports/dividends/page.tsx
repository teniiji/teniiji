import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DividendSimulator } from "./dividend-simulator";

export default async function DividendSimulatorPage() {
  const [members, paidInstallments] = await Promise.all([
    prisma.member.findMany({
      where: { shareAccount: { balanceMinor: { gt: 0 } } },
      include: { shareAccount: true },
      orderBy: { memberCode: "asc" },
    }),
    prisma.loanInstallment.findMany({
      where: { status: "PAID" },
      select: {
        interestDueMinor: true,
        loanContract: { select: { memberId: true } },
      },
    }),
  ]);

  const shareMembers = members.map((m) => ({
    memberId: m.id,
    memberCode: m.memberCode,
    fullName: m.fullName,
    baseMinor: m.shareAccount?.balanceMinor ?? 0,
  }));

  const interestByMember = new Map<string, number>();
  for (const inst of paidInstallments) {
    const key = inst.loanContract.memberId;
    interestByMember.set(key, (interestByMember.get(key) ?? 0) + inst.interestDueMinor);
  }
  const memberById = new Map(
    members.map((m) => [m.id, { memberCode: m.memberCode, fullName: m.fullName }])
  );
  // สมาชิกที่จ่ายดอกเบี้ยแล้วอาจไม่อยู่ใน `members` (ตัวกรองมีหุ้น > 0) จึงดึงข้อมูลสมาชิกเพิ่มเติมถ้าจำเป็น
  const extraMemberIds = [...interestByMember.keys()].filter((id) => !memberById.has(id));
  const extraMembers = extraMemberIds.length
    ? await prisma.member.findMany({ where: { id: { in: extraMemberIds } } })
    : [];
  for (const m of extraMembers) {
    memberById.set(m.id, { memberCode: m.memberCode, fullName: m.fullName });
  }

  const interestMembers = [...interestByMember.entries()]
    .filter(([, minor]) => minor > 0)
    .map(([memberId, baseMinor]) => {
      const m = memberById.get(memberId);
      return {
        memberId,
        memberCode: m?.memberCode ?? "-",
        fullName: m?.fullName ?? "-",
        baseMinor,
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/back-office/reports" className="text-sm text-primary hover:underline">
          ← กลับไปรายงานผู้บริหาร
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">จำลองเงินปันผล / เงินเฉลี่ยคืน</h1>
        <p className="mt-1 text-sm text-muted">
          คำนวณตัวอย่างการจัดสรรก่อนเสนอที่ประชุมใหญ่สามัญประจำปี — ไม่มีการบันทึกหรือจ่ายเงินจริงจากหน้านี้
          ปรับยอดที่จะจัดสรรได้อิสระเพื่อทดลองสถานการณ์ต่างๆ
        </p>
      </div>

      <DividendSimulator shareMembers={shareMembers} interestMembers={interestMembers} />
    </div>
  );
}
