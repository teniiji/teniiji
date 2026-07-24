export interface ScheduleRow {
  installmentNo: number;
  dueDate: Date;
  principalDueMinor: number;
  interestDueMinor: number;
  totalDueMinor: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * คำนวณตารางผ่อนชำระแบบลดต้นลดดอก (reducing balance / amortizing)
 * interestRateBps คือ อัตราดอกเบี้ยต่อปีเป็นจุดฐาน (basis points, 1% = 100 bps)
 */
export function buildAmortizationSchedule(params: {
  principalMinor: number;
  interestRateBps: number;
  termMonths: number;
  startDate: Date;
}): ScheduleRow[] {
  const { principalMinor, interestRateBps, termMonths, startDate } = params;
  if (principalMinor <= 0 || termMonths <= 0) {
    throw new Error("ข้อมูลเงินกู้ไม่ถูกต้อง");
  }

  const monthlyRate = interestRateBps / 10000 / 12;
  const payment =
    monthlyRate === 0
      ? principalMinor / termMonths
      : (principalMinor * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -termMonths));

  const rows: ScheduleRow[] = [];
  let remainingMinor = principalMinor;

  for (let i = 1; i <= termMonths; i++) {
    const interestDueMinor = Math.round(remainingMinor * monthlyRate);
    let principalDueMinor = Math.round(payment) - interestDueMinor;

    // งวดสุดท้าย: ปรับเงินต้นให้เท่ากับยอดคงเหลือจริง เพื่อลบผลสะสมจากการปัดเศษ
    if (i === termMonths || principalDueMinor > remainingMinor) {
      principalDueMinor = remainingMinor;
    }

    remainingMinor -= principalDueMinor;

    rows.push({
      installmentNo: i,
      dueDate: addMonths(startDate, i),
      principalDueMinor,
      interestDueMinor,
      totalDueMinor: principalDueMinor + interestDueMinor,
    });
  }

  return rows;
}
