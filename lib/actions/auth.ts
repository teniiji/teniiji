"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionCookie, destroySessionCookie, getSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { error: "ไม่พบชื่อผู้ใช้นี้ในระบบ" };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }

  await createSessionCookie({
    sub: user.id,
    username: user.username,
    role: user.role,
    memberId: user.memberId,
  });

  if (user.role === "MEMBER") {
    redirect("/portal");
  }
  redirect("/back-office");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

export async function getCurrentSession() {
  return getSession();
}
