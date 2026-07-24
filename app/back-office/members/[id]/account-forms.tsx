"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { depositAction, withdrawAction } from "@/lib/actions/savings";
import { recordShareContributionAction } from "@/lib/actions/shares";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="mt-2 rounded-md bg-flag-soft px-3 py-1.5 text-xs text-flag">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="mt-2 rounded-md bg-primary-soft px-3 py-1.5 text-xs text-primary-ink">
        {state.success}
      </p>
    );
  }
  return null;
}

export function DepositWithdrawForm({
  savingsAccountId,
  memberId,
}: {
  savingsAccountId: string;
  memberId: string;
}) {
  const [depositState, depositFormAction] = useActionState<ActionState, FormData>(
    depositAction,
    {}
  );
  const [withdrawState, withdrawFormAction] = useActionState<ActionState, FormData>(
    withdrawAction,
    {}
  );

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
      <form action={depositFormAction} className="flex flex-1 items-end gap-2">
        <input type="hidden" name="savingsAccountId" value={savingsAccountId} />
        <input type="hidden" name="memberId" value={memberId} />
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-ink">ฝากเงิน (บาท)</label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <SubmitButton label="ฝาก" pendingLabel="กำลังฝาก..." />
      </form>
      <form action={withdrawFormAction} className="flex flex-1 items-end gap-2">
        <input type="hidden" name="savingsAccountId" value={savingsAccountId} />
        <input type="hidden" name="memberId" value={memberId} />
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-ink">ถอนเงิน (บาท)</label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <SubmitButton label="ถอน" pendingLabel="กำลังถอน..." />
      </form>
      <div className="basis-full">
        <ActionMessage state={depositState} />
        <ActionMessage state={withdrawState} />
      </div>
    </div>
  );
}

export function ShareContributionForm({
  shareAccountId,
  memberId,
}: {
  shareAccountId: string;
  memberId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    recordShareContributionAction,
    {}
  );

  return (
    <form action={formAction} className="mt-3 flex items-end gap-2">
      <input type="hidden" name="shareAccountId" value={shareAccountId} />
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-ink">ซื้อหุ้นเพิ่ม (บาท)</label>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          required
          className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary sm:w-48"
        />
      </div>
      <SubmitButton label="บันทึก" pendingLabel="กำลังบันทึก..." />
      <div className="basis-full">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
