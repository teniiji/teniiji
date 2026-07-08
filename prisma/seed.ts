import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildAmortizationSchedule } from "@/lib/loan-schedule";
import { bahtToMinor } from "@/lib/money";

async function main() {
  console.log("Seeding database...");

  // ลบข้อมูลเดิมทั้งหมด (เรียงตามลำดับ dependency) เพื่อให้ seed ซ้ำได้
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.loanInstallment.deleteMany();
  await prisma.loanGuarantor.deleteMany();
  await prisma.loanContract.deleteMany();
  await prisma.shareAccount.deleteMany();
  await prisma.savingsAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const financeUser = await prisma.user.create({
    data: { username: "finance01", passwordHash, role: "STAFF_FINANCE" },
  });
  const loanUser = await prisma.user.create({
    data: { username: "loan01", passwordHash, role: "STAFF_LOAN" },
  });
  const managerUser = await prisma.user.create({
    data: { username: "manager01", passwordHash, role: "MANAGER" },
  });
  await prisma.user.create({
    data: { username: "admin01", passwordHash, role: "ADMIN" },
  });

  const somchai = await prisma.member.create({
    data: {
      memberCode: "M0001",
      fullName: "ครูสมชาย ใจดี",
      nationalId: "1100000000001",
      memberType: "ORDINARY",
      affiliation: "โรงเรียนบ้านหนองคาย",
    },
  });
  const somyingMember = await prisma.member.create({
    data: {
      memberCode: "M0002",
      fullName: "ครูสมหญิง มีสุข",
      nationalId: "1100000000002",
      memberType: "ORDINARY",
      affiliation: "โรงเรียนบ้านหนองคาย",
    },
  });
  const wichai = await prisma.member.create({
    data: {
      memberCode: "M0003",
      fullName: "ครูวิชัย ตั้งใจสอน",
      nationalId: "1100000000003",
      memberType: "ORDINARY",
      affiliation: "โรงเรียนหนองคายวิทยาคม",
    },
  });
  const aree = await prisma.member.create({
    data: {
      memberCode: "M0004",
      fullName: "ครูอารีย์ รักเรียน",
      nationalId: "1100000000004",
      memberType: "ORDINARY",
      status: "RETIRED",
      affiliation: "โรงเรียนหนองคายวิทยาคม (เกษียณ)",
    },
  });

  await prisma.user.create({
    data: {
      username: "member01",
      passwordHash,
      role: "MEMBER",
      memberId: somchai.id,
    },
  });

  const savingsAccounts: Record<string, { id: string }> = {};
  for (const [member, balance] of [
    [somchai, 45000],
    [somyingMember, 32000],
    [wichai, 18000],
    [aree, 60000],
  ] as const) {
    const acc = await prisma.savingsAccount.create({
      data: {
        memberId: member.id,
        accountNumber: `SA-${member.memberCode}`,
        type: "SAVINGS",
        interestRateBps: 150,
        balanceMinor: bahtToMinor(balance),
      },
    });
    savingsAccounts[member.id] = acc;

    await prisma.shareAccount.create({
      data: {
        memberId: member.id,
        monthlyContributionMinor: bahtToMinor(500),
        balanceMinor: bahtToMinor(balance / 3),
      },
    });
  }

  // เงินกู้สามัญของครูสมชาย: อนุมัติ+เบิกจ่ายแล้ว พร้อมผู้ค้ำ (ครูสมหญิง) และชำระไปแล้ว 1 งวด
  const disbursedAt = new Date();
  disbursedAt.setMonth(disbursedAt.getMonth() - 1);

  const loan = await prisma.loanContract.create({
    data: {
      memberId: somchai.id,
      type: "ORDINARY",
      principalMinor: bahtToMinor(50000),
      interestRateBps: 600, // 6% ต่อปี
      termMonths: 12,
      status: "DISBURSED",
      approvedAt: disbursedAt,
      disbursedAt,
    },
  });

  await prisma.loanGuarantor.create({
    data: {
      loanContractId: loan.id,
      memberId: somyingMember.id,
      guaranteedAmountMinor: bahtToMinor(50000),
    },
  });

  const schedule = buildAmortizationSchedule({
    principalMinor: loan.principalMinor,
    interestRateBps: loan.interestRateBps,
    termMonths: loan.termMonths,
    startDate: disbursedAt,
  });

  const installments = await Promise.all(
    schedule.map((row) =>
      prisma.loanInstallment.create({
        data: {
          loanContractId: loan.id,
          installmentNo: row.installmentNo,
          dueDate: row.dueDate,
          principalDueMinor: row.principalDueMinor,
          interestDueMinor: row.interestDueMinor,
        },
      })
    )
  );

  await prisma.transaction.create({
    data: {
      type: "LOAN_DISBURSEMENT",
      amountMinor: loan.principalMinor,
      memberId: somchai.id,
      savingsAccountId: savingsAccounts[somchai.id].id,
      loanContractId: loan.id,
      createdByUserId: financeUser.id,
      createdAt: disbursedAt,
    },
  });

  const firstInstallment = installments[0];
  const firstDue = firstInstallment.principalDueMinor + firstInstallment.interestDueMinor;
  await prisma.loanInstallment.update({
    where: { id: firstInstallment.id },
    data: { paidMinor: firstDue, status: "PAID", paidAt: new Date() },
  });
  await prisma.transaction.create({
    data: {
      type: "LOAN_PAYMENT",
      amountMinor: firstDue,
      memberId: somchai.id,
      loanContractId: loan.id,
      loanInstallmentId: firstInstallment.id,
      createdByUserId: financeUser.id,
    },
  });

  // คำขอกู้ฉุกเฉินของครูวิชัย: รอพิจารณา (สาธิต flow อนุมัติ/ปฏิเสธ/เบิกจ่าย)
  await prisma.loanContract.create({
    data: {
      memberId: wichai.id,
      type: "EMERGENCY",
      principalMinor: bahtToMinor(15000),
      interestRateBps: 700,
      termMonths: 6,
      status: "SUBMITTED",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: managerUser.id,
      action: "CREATE_MEMBER",
      entityType: "Member",
      entityId: somchai.id,
      after: JSON.stringify({ memberCode: somchai.memberCode }),
    },
  });

  console.log("Seed เสร็จสมบูรณ์");
  console.log("บัญชีตัวอย่าง: finance01 / loan01 / manager01 / admin01 / member01 — รหัสผ่าน password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
