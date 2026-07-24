"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendDueSoonRemindersAction } from "@/lib/actions/notifications";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังส่ง..." : "ส่งแจ้งเตือนงวดใกล้ครบกำหนด"}
    </button>
  );
}

export function ReminderButton() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    sendDueSoonRemindersAction,
    {}
  );

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-ink">แจ้งเตือนงวดเงินกู้ใกล้ครบกำหนด</h2>
      <p className="mt-1 text-xs text-muted">
        ตรวจสอบงวดที่ครบกำหนดภายใน 7 วันข้างหน้าและยังไม่ชำระ แล้วส่งแจ้งเตือนถึงสมาชิก
        (สำคัญโดยเฉพาะสมาชิกเกษียณที่ไม่ได้หักผ่านเงินเดือน) — ไม่มีตัวตั้งเวลาอัตโนมัติ ต้องกดเอง
        กันแจ้งซ้ำงวดเดิมให้อัตโนมัติ
      </p>
      <form action={formAction} className="mt-3">
        <SubmitButton />
      </form>
      {state.error && (
        <p className="mt-3 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-3 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
          {state.success}
        </p>
      )}
    </div>
  );
}
