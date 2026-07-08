/** เงินทุกจำนวนในระบบเก็บเป็นจำนวนเต็มหน่วยสตางค์ (Int minor units) เพื่อเลี่ยงปัญหาปัดเศษของ float */

export function bahtToMinor(baht: number): number {
  return Math.round(baht * 100);
}

export function minorToBaht(minor: number): number {
  return minor / 100;
}

export function formatBaht(minor: number): string {
  const baht = minorToBaht(minor);
  return baht.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "symbol",
  });
}

/** แปลงค่าจากฟอร์ม (string บาท) เป็นสตางค์ พร้อมตรวจสอบว่าเป็นจำนวนบวกที่ถูกต้อง */
export function parseBahtInput(value: FormDataEntryValue | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("จำนวนเงินไม่ถูกต้อง");
  }
  return bahtToMinor(n);
}
