import "server-only";
import { Resend } from "resend";
import { ROLE_LABELS, roleHome, type Role } from "@/lib/constants";

// This app had zero email-sending infrastructure until this shipped — same
// documented gap as SMS (CLAUDE.md §28/§29) until that got a stub-only
// build-out. Email is different: a "forgot password" flow is useless
// without a real, working send (unlike the AI-listing/marketing-SMS
// features, which have a genuinely useful degraded mode when unconfigured
// — a plain form, an honestly-logged stub). So this module still follows
// the same "not configured" fallback convention (RESEND_API_KEY unset →
// a clear, honest failure instead of a silent no-op or a crash), but
// callers must treat that failure as blocking, not cosmetic.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Cannabliz <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

// Exported so lib/lead-email.ts (real marketing email to leads, added
// alongside the SMS outreach tools) can send through the same Resend
// client/config rather than standing up a second one.
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "Email isn't configured yet — ask an Admin to reset your password instead." };
  }
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, text });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send the email — try again in a moment." };
  }
}

// Sent once, right after public self-signup (see signup/actions.ts's
// after() call) — this app had no welcome email at all until this shipped,
// unlike essentially every other SaaS product. Deliberately not sent for
// Admin/AE-assisted account creation (a Budtender, a Broker, a
// quick-signed-up Grower) — those flows already show/relay the login
// details directly to whoever's creating the account, and that person
// isn't necessarily the one checking the inbox on the new account's email
// address, so a "welcome, here's your login" email there could actually
// leak the fact an account exists to the wrong person before the real
// owner ever sees it. Public self-signup is the one flow where the email
// address on the account is guaranteed to belong to the person who just
// typed it in themselves.
export async function sendWelcomeEmail(to: string, fullName: string, role: Role): Promise<SendEmailResult> {
  const label = ROLE_LABELS[role] ?? "user";
  const portalUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}${roleHome(role)}`;
  const firstName = fullName.trim().split(/\s+/)[0] || "there";
  return sendEmail(
    to,
    "Welcome to Cannabliz",
    `<p>Hi ${firstName},</p>
     <p>Your Cannabliz account is set up as a <strong>${label}</strong>. You're ready to go — head to your
     portal to get started: <a href="${portalUrl}">${portalUrl}</a></p>
     <p>If you didn't create this account, you can ignore this email.</p>`,
    `Hi ${firstName},\n\n` +
      `Your Cannabliz account is set up as a ${label}. You're ready to go — head to your portal to get started:\n` +
      `${portalUrl}\n\n` +
      `If you didn't create this account, you can ignore this email.`
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendEmailResult> {
  return sendEmail(
    to,
    "Reset your Cannabliz password",
    `<p>Someone (hopefully you) requested a password reset for your Cannabliz account.</p>
     <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour and can only be used once.</p>
     <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    `Someone (hopefully you) requested a password reset for your Cannabliz account.\n\n` +
      `Set a new password: ${resetUrl}\n\n` +
      `This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.`
  );
}
