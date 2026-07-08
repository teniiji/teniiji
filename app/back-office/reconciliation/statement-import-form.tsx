"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { importBankStatementAction } from "@/lib/actions/reconciliation";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังนำเข้า..." : "นำเข้าไฟล์"}
    </button>
  );
}

export function StatementImportForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    importBankStatementAction,
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
        + นำเข้า Statement ธนาคาร / รายการโอนเงินจากสมาชิก
      </summary>
      <p className="mt-2 text-xs text-muted">
        รูปแบบไฟล์ CSV:{" "}
        <code className="rounded bg-surface-2 px-1 py-0.5">memberCode,amount,note</code>{" "}
        (สมมติฐาน — ยังไม่ทราบรูปแบบไฟล์จริงจากธนาคาร) — รายการที่จับคู่สมาชิกได้จะรอเจ้าหน้าที่ยืนยันก่อนบันทึกเป็นเงินฝากจริง
      </p>
      <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ชื่อ/แหล่งที่มาไฟล์</label>
          <input
            name="label"
            required
            placeholder="เช่น สเตทเมนต์กรุงไทย ก.ค. 2569"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ไฟล์ CSV</label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs"
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
