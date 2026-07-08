import { ApplyLoanForm } from "./apply-loan-form";

export default function ApplyLoanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ยื่นคำขอกู้เงินสามัญ</h1>
        <p className="mt-1 text-sm text-muted">
          กรอกข้อมูลเพื่อจำลองตารางผ่อนชำระ แล้วยื่นคำขอเพื่อรอเจ้าหน้าที่พิจารณา
        </p>
      </div>
      <ApplyLoanForm />
    </div>
  );
}
