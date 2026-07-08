"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createLoanContractAction } from "@/lib/actions/loans";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก..." : "สร้างคำขอกู้"}
    </button>
  );
}

export function NewLoanForm({
  members,
  defaultMemberId,
}: {
  members: { id: string; memberCode: string; fullName: string }[];
  defaultMemberId?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createLoanContractAction,
    {}
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-ink">สมาชิกผู้กู้</label>
        <select
          name="memberId"
          required
          defaultValue={defaultMemberId ?? ""}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="" disabled>
            -- เลือกสมาชิก --
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.memberCode} — {m.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">ประเภทเงินกู้</label>
        <select
          name="type"
          defaultValue="ORDINARY"
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="EMERGENCY">เงินกู้ฉุกเฉิน</option>
          <option value="ORDINARY">เงินกู้สามัญ (ใช้ผู้ค้ำ)</option>
          <option value="SPECIAL">เงินกู้พิเศษ (มีหลักประกัน)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">วงเงินกู้ (บาท)</label>
        <input
          name="principal"
          type="number"
          min="0"
          step="0.01"
          required
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">อัตราดอกเบี้ยต่อปี (%)</label>
        <input
          name="interestRatePercent"
          type="number"
          min="0"
          step="0.01"
          defaultValue="6"
          required
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">ระยะเวลากู้ (เดือน)</label>
        <input
          name="termMonths"
          type="number"
          min="1"
          max="240"
          defaultValue="12"
          required
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-ink">
          หลักประกัน (ถ้ามี)
        </label>
        <input
          name="collateralNote"
          placeholder="เช่น โฉนดที่ดินเลขที่ ..."
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">
          รหัสสมาชิกผู้ค้ำประกัน (ถ้ามี)
        </label>
        <input
          name="guarantorMemberCode"
          placeholder="เช่น M0002"
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">วงเงินค้ำประกัน (บาท)</label>
        <input
          name="guaranteedAmount"
          type="number"
          min="0"
          step="0.01"
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {state.error && (
        <p className="sm:col-span-2 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
