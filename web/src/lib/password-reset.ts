import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Deliberately does not reveal whether the email matched an account — the
// same "don't tell an attacker which emails exist" posture auth.ts's
// authorize() already follows with its uniform "Invalid email or
// password" message. Always returns the same shape regardless of whether
// a real token was minted and sent.
export type RequestResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordReset(email: string, origin: string): Promise<RequestResetResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Self-service password reset isn't set up yet — ask an Admin or your Account Executive to reset it for you.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Same shape whether or not the account exists, so this endpoint can't
  // be used to enumerate real emails — the actual email only goes out
  // when there's a real account to send it to.
  if (!user) return { ok: true };

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${origin}/reset-password?token=${rawToken}`;
  const sent = await sendPasswordResetEmail(user.email, resetUrl);
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

export type ValidateTokenResult = { ok: true; email: string } | { ok: false; error: string };

export async function validateResetToken(rawToken: string): Promise<ValidateTokenResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { email: true } } },
  });
  if (!record) return { ok: false, error: "This reset link is invalid." };
  if (record.usedAt) return { ok: false, error: "This reset link has already been used." };
  if (record.expiresAt < new Date()) return { ok: false, error: "This reset link has expired — request a new one." };
  return { ok: true, email: record.user.email };
}

export type CompleteResetResult = { ok: true; email: string } | { ok: false; error: string };

export async function completePasswordReset(rawToken: string, newPassword: string): Promise<CompleteResetResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (!record) return { ok: false, error: "This reset link is invalid." };
  if (record.usedAt) return { ok: false, error: "This reset link has already been used." };
  if (record.expiresAt < new Date()) return { ok: false, error: "This reset link has expired — request a new one." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, email: record.user.email };
}
