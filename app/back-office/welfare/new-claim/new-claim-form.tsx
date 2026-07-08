"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWelfareClaimAction } from "@/lib/actions/welfare";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก..." : "ยื่นคำขอ"}
    </button>
  );
}

export function NewClaimForm({
  members,
  funds,
}: {
  members: { id: string; memberCode: string; fullName: string }[];
  funds: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createWelfareClaimAction,
    {}
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink">สมาชิก</label>
        <select
          name="memberId"
          required
          defaultValue=""
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
        <label className="text-xs font-medium text-ink">กองทุน</label>
        <select
          name="welfareFundId"
          required
          defaultValue=""
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="" disabled>
            -- เลือกกองทุน --
          </option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-ink">เหตุผล/รายละเอียดคำขอ</label>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="เช่น ชื่อผู้เสียชีวิตและความสัมพันธ์ หรือชื่อบุตร/สถานศึกษา"
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
  );
}
