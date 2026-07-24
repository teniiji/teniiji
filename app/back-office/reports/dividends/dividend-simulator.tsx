"use client";

import { useMemo, useState } from "react";
import { formatBaht, bahtToMinor } from "@/lib/money";

interface MemberMetric {
  memberId: string;
  memberCode: string;
  fullName: string;
  baseMinor: number;
}

function DistributionTable({
  title,
  metricLabel,
  members,
  defaultPoolBaht,
}: {
  title: string;
  metricLabel: string;
  members: MemberMetric[];
  defaultPoolBaht: number;
}) {
  const [poolBaht, setPoolBaht] = useState(defaultPoolBaht);
  const poolMinor = bahtToMinor(Math.max(0, poolBaht || 0));
  const totalBaseMinor = members.reduce((sum, m) => sum + m.baseMinor, 0);

  const rows = useMemo(() => {
    if (totalBaseMinor <= 0) return [];
    return members
      .map((m) => {
        const ratio = m.baseMinor / totalBaseMinor;
        return { ...m, ratio, shareOfPoolMinor: Math.round(poolMinor * ratio) };
      })
      .sort((a, b) => b.baseMinor - a.baseMinor);
  }, [members, totalBaseMinor, poolMinor]);

  const distributedMinor = rows.reduce((sum, r) => sum + r.shareOfPoolMinor, 0);

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-1 sm:w-64">
        <label className="text-xs font-medium text-ink">
          จำนวนเงินที่จะจัดสรรทั้งหมด (บาท)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={poolBaht}
          onChange={(e) => setPoolBaht(Number(e.target.value))}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {totalBaseMinor <= 0 ? (
        <p className="mt-4 text-sm text-muted">ไม่มีข้อมูล{metricLabel}สำหรับคำนวณ</p>
      ) : (
        <div className="mt-4 max-h-80 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>
                <th className="py-1.5 text-left font-medium">สมาชิก</th>
                <th className="py-1.5 text-right font-medium">{metricLabel}</th>
                <th className="py-1.5 text-right font-medium">สัดส่วน</th>
                <th className="py-1.5 text-right font-medium">จัดสรรได้</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.memberId} className="border-t border-line">
                  <td className="py-1.5">
                    {r.memberCode} — {r.fullName}
                  </td>
                  <td className="py-1.5 text-right font-mono">{formatBaht(r.baseMinor)}</td>
                  <td className="py-1.5 text-right font-mono">
                    {(r.ratio * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 text-right font-mono font-semibold">
                    {formatBaht(r.shareOfPoolMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            รวมจัดสรรจริง {formatBaht(distributedMinor)} จากยอดที่ตั้งไว้ {formatBaht(poolMinor)}{" "}
            (ผลต่างเล็กน้อยเกิดจากการปัดเศษ)
          </p>
        </div>
      )}
    </section>
  );
}

export function DividendSimulator({
  shareMembers,
  interestMembers,
}: {
  shareMembers: MemberMetric[];
  interestMembers: MemberMetric[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <DistributionTable
        title="เงินปันผล (ตามสัดส่วนหุ้น)"
        metricLabel="ยอดหุ้น"
        members={shareMembers}
        defaultPoolBaht={100000}
      />
      <DistributionTable
        title="เงินเฉลี่ยคืน (ตามดอกเบี้ยเงินกู้ที่ชำระจริง)"
        metricLabel="ดอกเบี้ยที่ชำระ"
        members={interestMembers}
        defaultPoolBaht={20000}
      />
    </div>
  );
}
