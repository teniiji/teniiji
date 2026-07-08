/**
 * ตัว parser CSV แบบง่ายสำหรับ MVP นี้ — รองรับคอมมาคั่นค่า, ตัดช่องว่างหัวท้าย, ข้ามบรรทัดว่าง
 * ยังไม่รองรับค่าที่มีคอมม่าอยู่ในเครื่องหมายคำพูด (เกินขอบเขต MVP นี้ ดู
 * docs/design/07-ข้อสมมติฐานที่ต้องยืนยัน.md เรื่องรูปแบบไฟล์จริงที่ยังไม่ทราบแน่ชัด)
 */
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

/** ตัดแถวหัวตาราง (header) ออกถ้าแถวแรกไม่ใช่ตัวเลขในคอลัมน์ที่สอง (heuristic ง่ายๆ สำหรับไฟล์ที่มี/ไม่มี header) */
export function stripHeaderIfPresent(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const secondCell = rows[0][1];
  if (secondCell !== undefined && Number.isNaN(Number(secondCell))) {
    return rows.slice(1);
  }
  return rows;
}
