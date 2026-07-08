import { prisma } from "@/lib/prisma";
import { NewLoanForm } from "./new-loan-form";

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { memberId } = await searchParams;
  const members = await prisma.member.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, memberCode: true, fullName: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">สร้างคำขอกู้ใหม่</h1>
        <p className="mt-1 text-sm text-muted">
          กรอกข้อมูลเงินกู้ในนามของสมาชิก คำขอจะอยู่ในสถานะ &quot;รอพิจารณา&quot;
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <NewLoanForm members={members} defaultMemberId={memberId} />
      </div>
    </div>
  );
}
