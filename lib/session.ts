import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/generated/prisma/enums";

const COOKIE_NAME = "coop_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 ชั่วโมง

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("ไม่ได้ตั้งค่า SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // userId
  username: string;
  role: UserRole;
  memberId: string | null;
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as UserRole,
      memberId: (payload.memberId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** ใช้ในทุก server action ที่ต้องการจำกัดสิทธิ์ — อย่าพึ่ง layout guard เพียงอย่างเดียว */
export async function requireRole(
  allowed: UserRole[]
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  if (!allowed.includes(session.role)) {
    throw new Error("คุณไม่มีสิทธิ์ดำเนินการนี้");
  }
  return session;
}

export const STAFF_ROLES: UserRole[] = [
  "STAFF_FINANCE",
  "STAFF_LOAN",
  "MANAGER",
  "ADMIN",
];

/**
 * ชุดสิทธิ์ที่ใช้ร่วมกันระหว่าง server action (requireRole) และหน้าจอที่ซ่อน/แสดงฟอร์ม
 * ต้องใช้ค่าเดียวกันทั้งสองฝั่งเสมอ — ถ้าซ่อนปุ่มด้วยเงื่อนไขคนละชุดกับที่ action อนุญาต
 * ผู้ใช้ที่เห็นปุ่มแต่ action ปฏิเสธจะเจอ error ที่ไม่ได้ถูก catch (requireRole throw ตรงๆ)
 */
export const FINANCE_ROLES: UserRole[] = ["STAFF_FINANCE", "MANAGER", "ADMIN"];
export const LOAN_ROLES: UserRole[] = ["STAFF_LOAN", "MANAGER", "ADMIN"];
export const FINANCE_ADMIN_ROLES: UserRole[] = ["STAFF_FINANCE", "ADMIN"];
export const MANAGER_ADMIN_ROLES: UserRole[] = ["MANAGER", "ADMIN"];
