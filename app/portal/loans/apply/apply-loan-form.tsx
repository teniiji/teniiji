"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { applyLoanAsMemberAction } from "@/lib/actions/loans";
import { buildAmortizationSchedule } from "@/lib/loan-schedule";
import { formatBaht, bahtToMinor } from "@/lib/money";
import type { ActionState } from "@/lib/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "กำลังส่งคำขอ..." : "ยื่นคำขอกู้"}
    </button>
  );
}

export function ApplyLoanForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    applyLoanAsMemberAction,
    {}
  );

  const [principal, setPrincipal] = useState(50000);
  const [ratePercent, setRatePercent] = useState(6);
  const [termMonths, setTermMonths] = useState(12);

  const schedule = useMemo(() => {
    if (principal <= 0 || termMonths <= 0) return [];
    try {
      return buildAmortizationSchedule({
        principalMinor: bahtToMinor(principal),
        interestRateBps: Math.round(ratePercent * 100),
        termMonths,
        startDate: new Date(),
      });
    } catch {
      return [];
    }
  }, [principal, ratePercent, termMonths]);

  const monthlyPayment = schedule[0]?.totalDueMinor ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input type="hidden" name="type" value="ORDINARY" />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">วงเงินกู้ (บาท)</label>
          <input
            name="principal"
            type="number"
            min="0"
            step="0.01"
            required
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">อัตราดอกเบี้ยต่อปี (%)</label>
          <input
            name="interestRatePercent"
            type="number"
            min="0"
            step="0.01"
            required
            value={ratePercent}
            onChange={(e) => setRatePercent(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">ระยะเวลากู้ (เดือน)</label>
          <input
            name="termMonths"
            type="number"
            min="1"
            max="240"
            required
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink">หลักประกัน (ถ้ามี)</label>
          <input
            name="collateralNote"
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

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">จำลองตารางผ่อนชำระ</h2>
        <p className="mt-1 text-xs text-muted">
          ยอดผ่อนต่อเดือนโดยประมาณ:{" "}
          <span className="font-semibold text-primary-ink">
            {formatBaht(monthlyPayment)}
          </span>
        </p>
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 text-left font-medium">งวดที่</th>
                <th className="py-1 text-right font-medium">เงินต้น</th>
                <th className="py-1 text-right font-medium">ดอกเบี้ย</th>
                <th className="py-1 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.installmentNo} className="border-t border-line">
                  <td className="py-1">{row.installmentNo}</td>
                  <td className="py-1 text-right font-mono">
                    {formatBaht(row.principalDueMinor)}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatBaht(row.interestDueMinor)}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatBaht(row.totalDueMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
