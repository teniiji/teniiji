"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { decideWelfareClaimAction, payWelfareClaimAction } from "@/lib/actions/welfare";
import type { ActionState } from "@/lib/actions/members";

function ActionButton({
  label,
  pendingLabel,
  variant = "primary",
  confirmMessage,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "danger";
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "danger"
      ? "bg-flag text-white hover:opacity-90"
      : "bg-primary text-white hover:opacity-90";
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="mt-2 rounded-md bg-flag-soft px-3 py-2 text-sm text-flag">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="mt-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
        {state.success}
      </p>
    );
  }
  return null;
}

export function DecideClaimActions({ welfareClaimId }: { welfareClaimId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    decideWelfareClaimAction,
    {}
  );
  const [showReject, setShowReject] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="welfareClaimId" value={welfareClaimId} />
          <input type="hidden" name="decision" value="APPROVE" />
          <ActionButton label="อนุมัติ" pendingLabel="กำลังอนุมัติ..." />
        </form>
        {!showReject && (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            ปฏิเสธ
          </button>
        )}
      </div>
      {showReject && (
        <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="welfareClaimId" value={welfareClaimId} />
          <input type="hidden" name="decision" value="REJECT" />
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-ink">เหตุผลการปฏิเสธ</label>
            <input
              name="rejectionReason"
              required
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <ActionButton label="ยืนยันปฏิเสธ" pendingLabel="กำลังบันทึก..." variant="danger" />
        </form>
      )}
      <ActionMessage state={state} />
    </div>
  );
}

export function PayClaimAction({ welfareClaimId }: { welfareClaimId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    payWelfareClaimAction,
    {}
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="welfareClaimId" value={welfareClaimId} />
        <ActionButton
          label="จ่ายเงินสวัสดิการ"
          pendingLabel="กำลังจ่ายเงิน..."
          confirmMessage="ยืนยันจ่ายเงินสวัสดิการ? เงินจะเข้าบัญชีเงินฝากออมทรัพย์ของสมาชิกทันทีและไม่สามารถย้อนกลับได้"
        />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}
