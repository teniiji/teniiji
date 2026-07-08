import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "coop_session";

/**
 * ตรวจสอบหยาบๆ ว่า login แล้วหรือยัง (redirect เร็วๆ ก่อนถึง layout)
 * การตรวจสอบสิทธิ์ตาม role ที่แท้จริงอยู่ที่ layout.tsx ของแต่ละ route group
 * และ requireRole() ในทุก server action (proxy ไม่ครอบคลุม server action ที่ไม่อยู่ใน matcher)
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/back-office/:path*", "/portal/:path*"],
};
