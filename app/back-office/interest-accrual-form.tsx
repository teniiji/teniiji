"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runInterestAccrualAction } from "@/lib/actions/savings";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังประมวลผล..." : "ประมวลผลดอกเบี้ย"}
    </button>
  );
}

const defaultPeriod = new Date().toISOString().slice(0, 7);

export function InterestAccrualForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    runInterestAccrualAction,
    {}
  );

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-ink">
        ประมวลผลดอกเบี้ยเงินฝากประจำงวด
      </h2>
      <p className="mt-1 text-xs text-muted">
        ไม่มีตัวตั้งเวลาอัตโนมัติในระบบนี้ — ผู้จัดการ/แอดมินต้องกดประมวลผลเองทุกสิ้นเดือน
        (ทำซ้ำในงวดเดียวกันไม่ได้ ป้องกันการคิดดอกเบี้ยซ้ำ)
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="period" className="text-xs font-medium text-ink">
            งวด (ปี-เดือน)
          </label>
          <input
            id="period"
            name="period"
            type="month"
            defaultValue={defaultPeriod}
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <SubmitButton />
      </form>
      {state.error && (
        <p className="mt-3 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
          {state.success}
        </p>
      )}
    </div>
  );
}
