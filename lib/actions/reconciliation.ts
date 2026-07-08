"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, FINANCE_ADMIN_ROLES } from "@/lib/session";
import { bahtToMinor, formatBaht } from "@/lib/money";
import { parseCsv, stripHeaderIfPresent } from "@/lib/csv";
import { notifyMember } from "@/lib/notify";
import type { ActionState } from "@/lib/actions/members";

/**
 * นำเข้าผลการหักเงินเดือนจริงจากต้นสังกัด — จับคู่กับ PayrollDeductionRecord ในงวดที่เลือก
 * รูปแบบไฟล์ CSV (สมมติฐาน ยังไม่ทราบรูปแบบจริง): memberCode,actualAmount
 */
export async function importPayrollResultAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ADMIN_ROLES);
  const billingRunId = String(formData.get("billingRunId") ?? "");
  const file = formData.get("file");

  if (!billingRunId) return { error: "กรุณาเลือกงวดเรียกเก็บ" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาแนบไฟล์ CSV" };
  }

  const billingRun = await prisma.payrollBillingRun.findUnique({
    where: { id: billingRunId },
  });
  if (!billingRun) return { error: "ไม่พบงวดเรียกเก็บนี้" };

  const text = await file.text();
  const rows = stripHeaderIfPresent(parseCsv(text));
  if (rows.length === 0) return { error: "ไฟล์ไม่มีข้อมูล" };

  const members = await prisma.member.findMany({ select: { id: true, memberCode: true } });
  const memberByCode = new Map(members.map((m) => [m.memberCode, m.id]));

  const deductionRecords = await prisma.payrollDeductionRecord.findMany({
    where: { billingRunId },
  });
  const recordByMemberId = new Map(deductionRecords.map((r) => [r.memberId, r]));

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        type: "PAYROLL_RESULT",
        label: billingRun.period,
        rowCount: rows.length,
        importedByUserId: session.sub,
      },
    });

    const itemsToCreate: Array<{
      importBatchId: string;
      rawMemberCode: string;
      amountMinor: number;
      status: "UNMATCHED" | "RESOLVED";
      memberId: string | null;
      note: string;
    }> = [];

    for (const [rawMemberCode, rawAmount] of rows) {
      const amountMinor = bahtToMinor(Number(rawAmount));
      const memberId = memberByCode.get(rawMemberCode) ?? null;
      const record = memberId ? recordByMemberId.get(memberId) : undefined;

      if (!memberId || !record) {
        itemsToCreate.push({
          importBatchId: batch.id,
          rawMemberCode,
          amountMinor,
          status: "UNMATCHED",
          memberId,
          note: !memberId
            ? "ไม่พบรหัสสมาชิกนี้ในระบบ"
            : "ไม่พบรายการเรียกเก็บของสมาชิกนี้ในงวดที่เลือก",
        });
        continue;
      }

      await tx.payrollDeductionRecord.update({
        where: { id: record.id },
        data: { actualDeductedMinor: amountMinor },
      });

      const diff = amountMinor - record.totalDueMinor;
      const note =
        diff === 0
          ? "หักตรงตามยอดที่เรียกเก็บ"
          : diff > 0
            ? `หักเกิน ${formatBaht(diff)}`
            : `หักขาด ${formatBaht(-diff)}`;

      itemsToCreate.push({
        importBatchId: batch.id,
        rawMemberCode,
        amountMinor,
        memberId,
        status: "RESOLVED",
        note,
      });
    }

    await tx.reconciliationItem.createMany({ data: itemsToCreate });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "IMPORT_PAYROLL_RESULT",
        entityType: "ImportBatch",
        entityId: batch.id,
        after: JSON.stringify({ period: billingRun.period, rows: rows.length }),
      },
    });

    return batch;
  });

  revalidatePath("/back-office/reconciliation");
  return { success: `นำเข้าผลการหักเงินเดือนงวด ${billingRun.period} เรียบร้อยแล้ว (${rows.length} รายการ)` };
}

/**
 * นำเข้า statement ธนาคาร/รายการโอนเงินจากสมาชิก — จับคู่ด้วยรหัสสมาชิกเบื้องต้น
 * ต้องให้เจ้าหน้าที่ยืนยันก่อนจึงจะบันทึกเป็นธุรกรรมฝากเงินจริง (ไม่ auto-post)
 * รูปแบบไฟล์ CSV (สมมติฐาน ยังไม่ทราบรูปแบบจริง): memberCode,amount,note
 */
export async function importBankStatementAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ADMIN_ROLES);
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");

  if (!label) return { error: "กรุณาระบุชื่อ/แหล่งที่มาของไฟล์" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาแนบไฟล์ CSV" };
  }

  const text = await file.text();
  const rows = stripHeaderIfPresent(parseCsv(text));
  if (rows.length === 0) return { error: "ไฟล์ไม่มีข้อมูล" };

  const members = await prisma.member.findMany({ select: { id: true, memberCode: true } });
  const memberByCode = new Map(members.map((m) => [m.memberCode, m.id]));

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        type: "BANK_STATEMENT",
        label,
        rowCount: rows.length,
        importedByUserId: session.sub,
      },
    });

    const itemsToCreate = rows.map(([rawMemberCode, rawAmount, rawNote]) => {
      const amountMinor = bahtToMinor(Number(rawAmount));
      const memberId = memberByCode.get(rawMemberCode) ?? null;
      return {
        importBatchId: batch.id,
        rawMemberCode,
        amountMinor,
        memberId,
        note: rawNote || null,
        status: memberId ? ("MATCHED" as const) : ("UNMATCHED" as const),
      };
    });

    await tx.reconciliationItem.createMany({ data: itemsToCreate });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "IMPORT_BANK_STATEMENT",
        entityType: "ImportBatch",
        entityId: batch.id,
        after: JSON.stringify({ label, rows: rows.length }),
      },
    });

    return batch;
  });

  revalidatePath("/back-office/reconciliation");
  return { success: `นำเข้า statement "${label}" เรียบร้อยแล้ว (${rows.length} รายการ)` };
}

/** เจ้าหน้าที่ระบุรหัสสมาชิกด้วยตนเองสำหรับรายการที่จับคู่อัตโนมัติไม่ได้ */
export async function assignReconciliationMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(FINANCE_ADMIN_ROLES);
  const reconciliationItemId = String(formData.get("reconciliationItemId") ?? "");
  const memberCode = String(formData.get("memberCode") ?? "").trim();

  const item = await prisma.reconciliationItem.findUnique({
    where: { id: reconciliationItemId },
  });
  if (!item || item.status !== "UNMATCHED") {
    return { error: "รายการนี้ไม่อยู่ในสถานะที่ระบุสมาชิกได้" };
  }

  const member = await prisma.member.findUnique({ where: { memberCode } });
  if (!member) return { error: "ไม่พบรหัสสมาชิกนี้" };

  await prisma.reconciliationItem.update({
    where: { id: reconciliationItemId },
    data: { memberId: member.id, status: "MATCHED" },
  });

  revalidatePath(`/back-office/reconciliation`);
  return { success: `ระบุสมาชิก ${member.fullName} ให้รายการนี้แล้ว` };
}

/** ยืนยันรายการที่จับคู่แล้ว -> บันทึกเป็นธุรกรรมฝากเงินจริงเข้าบัญชีออมทรัพย์ของสมาชิก */
export async function resolveReconciliationItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRole(FINANCE_ADMIN_ROLES);
  const reconciliationItemId = String(formData.get("reconciliationItemId") ?? "");

  const item = await prisma.reconciliationItem.findUnique({
    where: { id: reconciliationItemId },
  });
  if (!item || item.status !== "MATCHED" || !item.memberId) {
    return { error: "รายการนี้ไม่อยู่ในสถานะที่ยืนยันได้" };
  }

  const savingsAccount = await prisma.savingsAccount.findFirst({
    where: { memberId: item.memberId, type: "SAVINGS" },
  });
  if (!savingsAccount) {
    return { error: "สมาชิกยังไม่มีบัญชีเงินฝากออมทรัพย์" };
  }

  await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: {
        type: "DEPOSIT",
        amountMinor: item.amountMinor,
        memberId: item.memberId!,
        savingsAccountId: savingsAccount.id,
        note: `กระทบยอดจากการนำเข้าไฟล์: ${item.note ?? ""}`.trim(),
        createdByUserId: session.sub,
      },
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: { balanceMinor: { increment: item.amountMinor } },
    });

    await tx.reconciliationItem.update({
      where: { id: reconciliationItemId },
      data: { status: "RESOLVED", matchedTransactionId: txn.id },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.sub,
        action: "RESOLVE_RECONCILIATION_ITEM",
        entityType: "Transaction",
        entityId: txn.id,
        after: JSON.stringify({ reconciliationItemId, amountMinor: item.amountMinor }),
      },
    });
  });

  await notifyMember({
    memberId: item.memberId,
    title: "ได้รับเงินโอนเข้าบัญชีของท่านแล้ว",
    body: `เงินฝากจำนวน ${formatBaht(item.amountMinor)} ได้เข้าบัญชีเงินฝากออมทรัพย์ของท่านแล้วจากการกระทบยอด`,
  });

  revalidatePath("/back-office/reconciliation");
  return { success: "บันทึกเป็นธุรกรรมฝากเงินเรียบร้อยแล้ว" };
}

export async function ignoreReconciliationItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(FINANCE_ADMIN_ROLES);
  const reconciliationItemId = String(formData.get("reconciliationItemId") ?? "");

  const item = await prisma.reconciliationItem.findUnique({
    where: { id: reconciliationItemId },
  });
  if (!item || (item.status !== "UNMATCHED" && item.status !== "MATCHED")) {
    return { error: "รายการนี้ไม่อยู่ในสถานะที่ละเว้นได้" };
  }

  await prisma.reconciliationItem.update({
    where: { id: reconciliationItemId },
    data: { status: "IGNORED" },
  });

  revalidatePath("/back-office/reconciliation");
  return { success: "ละเว้นรายการนี้แล้ว" };
}
