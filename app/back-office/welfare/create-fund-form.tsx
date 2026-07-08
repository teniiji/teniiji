"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWelfareFundAction } from "@/lib/actions/welfare";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก..." : "สร้างกองทุน"}
    </button>
  );
}

export function CreateFundForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createWelfareFundAction,
    {}
  );

  return (
    <details className="rounded-lg border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-bold text-ink">
        + สร้างกองทุนสวัสดิการใหม่
      </summary>
      <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ประเภทกองทุน</label>
          <select
            name="type"
            defaultValue="FUNERAL"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="FUNERAL">เงินสงเคราะห์ศพ (ฌกส./ฌส.)</option>
            <option value="EDUCATION">ทุนการศึกษาบุตรสมาชิก</option>
            <option value="MEDICAL">สวัสดิการรักษาพยาบาล</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ชื่อกองทุน</label>
          <input
            name="name"
            required
            placeholder="เช่น เงินสงเคราะห์ศพสมาชิก ประจำปี 2569"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">จำนวนเงินต่อคำขอ (บาท)</label>
          <input
            name="benefitAmount"
            type="number"
            min="0"
            step="0.01"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">
            อายุสมาชิกภาพขั้นต่ำ (เดือน)
          </label>
          <input
            name="minMembershipMonths"
            type="number"
            min="0"
            defaultValue="0"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-ink">รายละเอียด (ถ้ามี)</label>
          <input
            name="description"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        {state.error && (
          <p className="sm:col-span-2 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="sm:col-span-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
            {state.success}
          </p>
        )}
        <div className="sm:col-span-2">
          <SubmitButton />
        </div>
      </form>
    </details>
  );
}
