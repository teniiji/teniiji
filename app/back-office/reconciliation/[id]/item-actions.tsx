"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resolveReconciliationItemAction,
  assignReconciliationMemberAction,
  ignoreReconciliationItemAction,
} from "@/lib/actions/reconciliation";
import type { ActionState } from "@/lib/actions/members";

function ActionButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "outline";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "outline"
      ? "border border-line bg-surface text-ink hover:bg-surface-2"
      : "bg-primary text-white hover:opacity-90";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-1.5 text-xs text-flag">{state.error}</p>;
  if (state.success) return <p className="mt-1.5 text-xs text-primary-ink">{state.success}</p>;
  return null;
}

export function ResolveAndIgnore({ reconciliationItemId }: { reconciliationItemId: string }) {
  const [resolveState, resolveFormAction] = useActionState<ActionState, FormData>(
    resolveReconciliationItemAction,
    {}
  );
  const [ignoreState, ignoreFormAction] = useActionState<ActionState, FormData>(
    ignoreReconciliationItemAction,
    {}
  );

  return (
    <div>
      <div className="flex gap-2">
        <form action={resolveFormAction}>
          <input type="hidden" name="reconciliationItemId" value={reconciliationItemId} />
          <ActionButton label="ยืนยันบันทึกเป็นเงินฝาก" pendingLabel="กำลังบันทึก..." />
        </form>
        <form action={ignoreFormAction}>
          <input type="hidden" name="reconciliationItemId" value={reconciliationItemId} />
          <ActionButton label="ละเว้น" pendingLabel="กำลังบันทึก..." variant="outline" />
        </form>
      </div>
      <ActionMessage state={resolveState} />
      <ActionMessage state={ignoreState} />
    </div>
  );
}

export function IgnoreOnly({ reconciliationItemId }: { reconciliationItemId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    ignoreReconciliationItemAction,
    {}
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="reconciliationItemId" value={reconciliationItemId} />
        <ActionButton label="ละเว้น" pendingLabel="กำลังบันทึก..." variant="outline" />
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function AssignMemberAndIgnore({
  reconciliationItemId,
}: {
  reconciliationItemId: string;
}) {
  const [assignState, assignFormAction] = useActionState<ActionState, FormData>(
    assignReconciliationMemberAction,
    {}
  );
  const [ignoreState, ignoreFormAction] = useActionState<ActionState, FormData>(
    ignoreReconciliationItemAction,
    {}
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={assignFormAction} className="flex items-center gap-2">
          <input type="hidden" name="reconciliationItemId" value={reconciliationItemId} />
          <input
            name="memberCode"
            placeholder="รหัสสมาชิกที่ถูกต้อง"
            required
            className="w-32 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <ActionButton label="ระบุสมาชิก" pendingLabel="กำลังบันทึก..." />
        </form>
        <form action={ignoreFormAction}>
          <input type="hidden" name="reconciliationItemId" value={reconciliationItemId} />
          <ActionButton label="ละเว้น" pendingLabel="กำลังบันทึก..." variant="outline" />
        </form>
      </div>
      <ActionMessage state={assignState} />
      <ActionMessage state={ignoreState} />
    </div>
  );
}
