"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAnnouncementAction } from "@/lib/actions/notifications";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังส่ง..." : "ส่งประกาศ"}
    </button>
  );
}

export function AnnouncementForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createAnnouncementAction,
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
        + ส่งประกาศ/ข่าวสารถึงสมาชิกทุกคน
      </summary>
      <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-ink">หัวข้อ</label>
          <input
            name="title"
            required
            placeholder="เช่น ประกาศอัตราดอกเบี้ยเงินฝากใหม่"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-ink">เนื้อหา</label>
          <textarea
            name="body"
            required
            rows={3}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ช่องทาง</label>
          <select
            name="channel"
            defaultValue="IN_APP"
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="IN_APP">ในแอป (พอร์ทัลสมาชิก) — ใช้งานได้ทันที</option>
            <option value="LINE">LINE OA — ยังไม่เชื่อมต่อ (รอ credential)</option>
            <option value="SMS">SMS — ยังไม่เชื่อมต่อ (รอ credential)</option>
            <option value="EMAIL">อีเมล — ยังไม่เชื่อมต่อ (รอ credential)</option>
          </select>
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
