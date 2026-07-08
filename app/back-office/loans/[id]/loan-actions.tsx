"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  approveLoanAction,
  rejectLoanAction,
  disburseLoanAction,
  recordLoanPaymentAction,
} from "@/lib/actions/loans";
import type { ActionState } from "@/lib/actions/members";

function ActionButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "danger" | "outline";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-primary text-white hover:opacity-90",
    danger: "bg-flag text-white hover:opacity-90",
    outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
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

export function ApproveRejectActions({
  loanContractId,
  showApprove,
  showReject,
}: {
  loanContractId: string;
  showApprove: boolean;
  showReject: boolean;
}) {
  const [approveState, approveFormAction] = useActionState<ActionState, FormData>(
    approveLoanAction,
    {}
  );
  const [rejectState, rejectFormAction] = useActionState<ActionState, FormData>(
    rejectLoanAction,
    {}
  );

  return (
    <div>
      <div className="flex gap-3">
        {showApprove && (
          <form action={approveFormAction}>
            <input type="hidden" name="loanContractId" value={loanContractId} />
            <ActionButton label="อนุมัติ" pendingLabel="กำลังอนุมัติ..." />
          </form>
        )}
        {showReject && (
          <form action={rejectFormAction}>
            <input type="hidden" name="loanContractId" value={loanContractId} />
            <ActionButton label="ปฏิเสธ" pendingLabel="กำลังบันทึก..." variant="danger" />
          </form>
        )}
      </div>
      {showApprove && <ActionMessage state={approveState} />}
      {showReject && <ActionMessage state={rejectState} />}
    </div>
  );
}

export function DisburseAction({ loanContractId }: { loanContractId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    disburseLoanAction,
    {}
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="loanContractId" value={loanContractId} />
        <ActionButton label="เบิกจ่ายเงินกู้" pendingLabel="กำลังเบิกจ่าย..." />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function RecordPaymentForm({
  loanInstallmentId,
}: {
  loanInstallmentId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    recordLoanPaymentAction,
    {}
  );

  return (
    <div>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="loanInstallmentId" value={loanInstallmentId} />
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="จำนวนเงิน"
          className="w-28 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <ActionButton label="บันทึกชำระ" pendingLabel="กำลังบันทึก..." variant="outline" />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}
