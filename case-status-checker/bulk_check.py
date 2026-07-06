"""
ตรวจสอบสถานะ "บุคคลล้มละลาย" จากเว็บไซต์กรมบังคับคดี (led.go.th) แบบกลุ่ม (bulk)
โดยอ่านรายชื่อ/เลขบัตรประชาชนจากไฟล์ Excel แล้วกรอกเลขบัตรในฟอร์มค้นหาให้อัตโนมัติทีละคน

เนื่องจากฟอร์มค้นหาของกรมบังคับคดีมี CAPTCHA ป้องกันการยิงคำขอซ้ำๆ อัตโนมัติ
(และจากการทดสอบจริงพบว่าเว็บไซต์จะล้างค่าช่อง CAPTCHA ทิ้งถ้าเป็นการกรอกด้วยสคริปต์
แทนที่จะเป็นการพิมพ์จริงของคน) สคริปต์นี้จึง "ไม่แตะช่อง CAPTCHA เลย" ผู้ใช้ต้องเป็น
คนพิมพ์รหัส CAPTCHA และกดปุ่ม "ค้นหา" เองในเบราว์เซอร์จริงทุกครั้ง ส่วนที่เหลือ
(ล็อกอิน session ค้าง, กรอกเลขบัตร, อ่านผลลัพธ์, บันทึกไฟล์, ไปรายชื่อถัดไป)
ทำให้อัตโนมัติทั้งหมด

วิธีใช้งาน:
    pip install -r requirements.txt
    playwright install chromium
    python bulk_check.py --input CardID.xlsx --sheet 0769 --output results.xlsx

ระหว่างรัน:
    - สคริปต์จะเปิดเบราว์เซอร์เปล่าขึ้นมา ให้ผู้ใช้นำทาง/ล็อกอินเองตามปกติ
      (พิมพ์ URL, ล็อกอิน, คลิกเมนู) จนกว่าจะเปิดหน้า "สอบถามบุคคลล้มละลาย"
      (WEB3Q010) ได้สำเร็จ 1 ครั้ง แล้วกด Enter ในหน้าต่าง terminal เพื่อให้
      สคริปต์ทำงานต่อ
    - จากนั้นสำหรับแต่ละรายชื่อ สคริปต์จะกรอกเลขบัตรประชาชนให้ในหน้าเว็บ แล้วรอ
      ให้ผู้ใช้ไปที่เบราว์เซอร์ พิมพ์รหัส CAPTCHA และกดปุ่ม "ค้นหา" เอง
      (ถ้าเผลอพิมพ์ CAPTCHA ผิด เว็บจะแจ้งเตือน กด OK แล้วพิมพ์ใหม่ กดค้นหาอีกครั้ง
      ได้เลยในหน้าเดิม ไม่ต้องกลับมาที่ terminal จนกว่าจะเห็นผลลัพธ์ขึ้นจริง)
    - เมื่อเห็นผลลัพธ์ขึ้นในหน้าเว็บแล้ว กลับมาที่ terminal แล้วกด Enter สคริปต์จะ
      อ่านผลลัพธ์ บันทึกลงไฟล์ แล้วพาไปหน้าค้นหาว่างสำหรับรายชื่อถัดไปให้เอง
    - ผลลัพธ์จะถูกบันทึกลงไฟล์ Excel ทันทีหลังตรวจแต่ละราย ถ้าสคริปต์ถูกปิดกลางคัน
      รันคำสั่งเดิมซ้ำได้เลย มันจะข้ามรายชื่อที่ตรวจสอบไปแล้วในไฟล์ผลลัพธ์โดยอัตโนมัติ

หมายเหตุสำคัญ: สคริปต์นี้เขียนจาก HTML จริงของหน้าฟอร์ม "สอบถามบุคคลล้มละลาย"
(WEB3Q010) และข้อความ "ไม่พบรายการที่ค้นหา" ที่ยืนยันจากการทดสอบจริงแล้ว แต่ยังควร
ทดสอบกับรายชื่อ 3-5 รายก่อน (--limit 5) แล้วตรวจสอบผลลัพธ์ให้ตรงกับที่เห็นในเบราว์เซอร์
จริง ก่อนรันเต็มจำนวน
"""

import argparse
import datetime as dt
from pathlib import Path

import openpyxl
from playwright.sync_api import sync_playwright

FORM_URL = "https://ledwebsite.led.go.th/ledweb/led/web/system/WEB3Q010Action.do"

STATUS_CLEAR = "ไม่พบคดี"
STATUS_FOUND = "พบคดี"
STATUS_ERROR = "ตรวจสอบไม่สำเร็จ"

NOT_FOUND_TEXT = "ไม่พบรายการที่ค้นหา"

OUTPUT_HEADERS = [
    "เลขทะเบียนสมาชิก",
    "เลขบัตรประชาชน",
    "ชื่อ-นามสกุล (จากไฟล์)",
    "สถานะคดี",
    "รายละเอียดคดีที่พบ",
    "ตรวจสอบเมื่อ",
]


def read_input_rows(path, sheet_name, id_col, member_col, name_col):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet_name]
    rows = []
    for row in ws.iter_rows(min_row=1, values_only=True):
        raw_id = row[id_col]
        if raw_id is None:
            continue
        id_str = str(raw_id).strip()
        if not id_str.isdigit() or len(id_str) != 13:
            continue
        member_no = str(row[member_col]).strip() if row[member_col] is not None else ""
        name = str(row[name_col]).strip() if row[name_col] is not None else ""
        rows.append({"id": id_str, "member_no": member_no, "name": name})
    return rows


def load_done_ids(output_path):
    done = set()
    if not Path(output_path).exists():
        return done
    wb = openpyxl.load_workbook(output_path)
    ws = wb.active
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row and row[1]:
            done.add(str(row[1]).strip())
    return done


def open_or_create_output(output_path):
    if Path(output_path).exists():
        wb = openpyxl.load_workbook(output_path)
        ws = wb.active
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(OUTPUT_HEADERS)
    return wb, ws


def append_result(wb, ws, output_path, record, status, detail):
    ws.append([
        record["member_no"],
        record["id"],
        record["name"],
        status,
        detail,
        dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    ])
    wb.save(output_path)


def fill_search_form(page, record):
    page.fill("input[name='dfId']", record["id"])
    page.check("input[name='typeQuery'][value='1']")  # ตรงตัว (exact match) สำหรับค้นด้วยเลขบัตร


def parse_results_table(page):
    """คืนค่า (status, detail_text) จากตาราง lkPccBankruptTable หลังค้นหา."""
    table_text = page.locator("#lkPccBankruptTable").inner_text()

    if NOT_FOUND_TEXT in table_text:
        return STATUS_CLEAR, ""

    rows = page.locator(
        "#scrollContent_lkPccBankruptTable tr:not(.tableEmptyCell)"
    )
    count = rows.count()
    cases = []
    for i in range(count):
        cells = rows.nth(i).locator("td")
        if cells.count() < 6:
            continue
        full_name = cells.nth(1).inner_text().strip()
        if not full_name or full_name == "\xa0":
            continue
        recv_case = cells.nth(2).inner_text().strip()
        court = cells.nth(3).inner_text().strip()
        black_no = cells.nth(4).inner_text().strip()
        red_no = cells.nth(5).inner_text().strip()
        cases.append(
            f"{full_name} | เรื่องที่ {recv_case} | {court} | ดำที่ {black_no} | แดงที่ {red_no}"
        )

    if cases:
        return STATUS_FOUND, "; ".join(cases)

    # ไม่เจอทั้งข้อความ "ไม่พบรายการที่ค้นหา" และไม่เจอแถวข้อมูลจริง — อาจแปลว่า
    # ยังไม่ได้กดค้นหา หรือ CAPTCHA ยังไม่ผ่าน ไม่ควรเดาว่า "ไม่พบคดี" เฉยๆ
    return STATUS_ERROR, "ไม่พบข้อความยืนยันผลลัพธ์ที่คาดไว้ในตาราง ควรตรวจสอบด้วยตนเอง"


def process_one(page, record):
    """คืนค่า (status, detail). ผู้ใช้เป็นคนพิมพ์ CAPTCHA และกดค้นหาเองในเบราว์เซอร์."""
    page.goto(FORM_URL, wait_until="networkidle")
    fill_search_form(page, record)

    print(f"\n  ผู้ตรวจสอบ: {record['name']}  เลขบัตร: {record['id']}")
    print("  กรอกเลขบัตรในหน้าเว็บให้แล้ว — ไปที่เบราว์เซอร์ พิมพ์รหัส CAPTCHA แล้วกดปุ่ม")
    print("  \"ค้นหา\" เองในหน้าเว็บ (ถ้า CAPTCHA ผิด เว็บจะแจ้งเตือน กด OK แล้วลองใหม่ได้เลย)")
    response = input(
        "  เห็นผลลัพธ์ขึ้นในหน้าเว็บแล้ว กด Enter ที่นี่ (หรือพิมพ์ 's' เพื่อข้ามรายนี้): "
    ).strip()

    if response.lower() == "s":
        return STATUS_ERROR, "ผู้ใช้เลือกข้ามรายนี้"

    return parse_results_table(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="CardID.xlsx", help="ไฟล์ Excel รายชื่อ/เลขบัตรประชาชน")
    parser.add_argument("--sheet", default="0769", help="ชื่อชีตในไฟล์ input")
    parser.add_argument("--id-col", type=int, default=0, help="index คอลัมน์เลขบัตรประชาชน (0=A)")
    parser.add_argument("--member-col", type=int, default=1, help="index คอลัมน์เลขทะเบียนสมาชิก (0=A)")
    parser.add_argument("--name-col", type=int, default=2, help="index คอลัมน์ชื่อ-นามสกุล (0=A)")
    parser.add_argument("--output", default="results.xlsx", help="ไฟล์ผลลัพธ์ (จะสร้าง/ต่อท้ายให้)")
    parser.add_argument("--limit", type=int, default=0, help="จำกัดจำนวนรายชื่อที่จะตรวจ (0 = ไม่จำกัด) ใช้สำหรับทดสอบ")
    args = parser.parse_args()

    print(f"กำลังอ่านไฟล์ input: {args.input} (ชีต {args.sheet})")
    records = read_input_rows(args.input, args.sheet, args.id_col, args.member_col, args.name_col)
    print(f"พบรายชื่อทั้งหมด {len(records)} ราย")

    done_ids = load_done_ids(args.output)
    if done_ids:
        print(f"พบผลลัพธ์เดิมในไฟล์ output {len(done_ids)} ราย จะข้ามรายที่ตรวจไปแล้ว")
    remaining = [r for r in records if r["id"] not in done_ids]

    if args.limit:
        remaining = remaining[: args.limit]

    print(f"จะตรวจสอบทั้งหมด {len(remaining)} ราย ในรอบนี้\n")
    if not remaining:
        print("ไม่มีรายชื่อที่ต้องตรวจสอบเพิ่ม")
        return

    wb, ws = open_or_create_output(args.output)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 60)
        print("ในหน้าต่างเบราว์เซอร์ที่เปิดขึ้นมา กรุณาพิมพ์ URL แล้วนำทางไปด้วยตนเอง")
        print("เหมือนที่คุณทำเป็นปกติ จนกว่าจะเข้าสู่ระบบและเปิดหน้า")
        print("'สอบถามบุคคลล้มละลาย' (WEB3Q010) ได้สำเร็จ 1 ครั้ง")
        print("เสร็จแล้วกลับมาที่ terminal นี้แล้วกด Enter เพื่อเริ่มตรวจสอบ")
        print("=" * 60)
        input()

        counts = {STATUS_CLEAR: 0, STATUS_FOUND: 0, STATUS_ERROR: 0}
        total = len(remaining)
        for idx, record in enumerate(remaining, start=1):
            print(f"\n[{idx}/{total}] ===================================")
            try:
                status, detail = process_one(page, record)
            except KeyboardInterrupt:
                print("\nหยุดโดยผู้ใช้ — ผลลัพธ์ที่ตรวจไปแล้วถูกบันทึกไว้แล้ว")
                break
            except Exception as e:
                status, detail = STATUS_ERROR, f"เกิดข้อผิดพลาด: {e}"

            append_result(wb, ws, args.output, record, status, detail)
            counts[status] = counts.get(status, 0) + 1
            print(f"  ผลลัพธ์: {status} {('- ' + detail) if detail else ''}")

        browser.close()

        print("\n" + "=" * 60)
        print("สรุปผลรอบนี้")
        for k, v in counts.items():
            print(f"  {k}: {v} ราย")
        print(f"บันทึกผลลัพธ์ทั้งหมดไว้ที่: {args.output}")


if __name__ == "__main__":
    main()
