"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMemberAction } from "@/lib/actions/members";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก..." : "เพิ่มสมาชิก"}
    </button>
  );
}

export function CreateMemberForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createMemberAction,
    {}
  );
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-lg border border-line bg-surface p-5"
    >
      <summary className="cursor-pointer text-sm font-bold text-ink">
        + เพิ่มสมาชิกใหม่
      </summary>
      <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">รหัสสมาชิก</label>
          <input
            name="memberCode"
            required
            placeholder="เช่น M0001"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ชื่อ-นามสกุล</label>
          <input
            name="fullName"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">เลขบัตรประชาชน</label>
          <input
            name="nationalId"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ต้นสังกัด</label>
          <input
            name="affiliation"
            required
            placeholder="เช่น โรงเรียนบ้านหนองคาย"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ประเภทสมาชิก</label>
          <select
            name="memberType"
            defaultValue="ORDINARY"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="ORDINARY">สมาชิกสามัญ</option>
            <option value="ASSOCIATE">สมาชิกสมทบ</option>
          </select>
        </div>
        <div className="flex items-end">
          <SubmitButton />
        </div>
        {state.error && (
          <p className="col-span-full rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="col-span-full rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
            {state.success}
          </p>
        )}
      </form>
    </details>
  );
}
