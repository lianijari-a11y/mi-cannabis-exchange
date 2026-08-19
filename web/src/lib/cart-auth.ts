"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";

// The license-first inline sign-in flow for the public menu/collection
// cart pages (components/cart/license-auth-flow.tsx) — the human's own
// spec, in sequence: the retailer clicks Accept/Counter/Reject FIRST
// (never gated behind a separate "create account" landing state), and
// only Accept/Counter (the two that actually write to the DB) trigger
// this flow if they're not already signed in as a retailer. Step one is
// always a license number, never an email — this app already treats a
// license number as the retailer's real identity everywhere else
// (§12/§36), so re-using it here instead of inventing a second identity
// concept is deliberate.
export type LicenseCheckResult =
  | { status: "existing"; mustChangePassword: boolean }
  | { status: "new"; businessName: string }
  | { status: "not_found" };

export async function checkRetailerLicense(licenseNumberRaw: string): Promise<LicenseCheckResult> {
  const licenseNumber = licenseNumberRaw.trim();
  if (!licenseNumber) return { status: "not_found" };

  const existing = await prisma.user.findFirst({
    where: { role: "retailer", licenseNumber },
    select: { mustChangePassword: true },
  });
  if (existing) return { status: "existing", mustChangePassword: existing.mustChangePassword };

  const match = await lookupLicense(licenseNumber, "retailer");
  if (!match.found || !match.businessName) return { status: "not_found" };
  return { status: "new", businessName: match.businessName };
}

export type CartAuthResult = { ok: true } | { ok: false; error: string };

// Existing account, real (not temporary) password — a normal sign-in,
// just keyed by license number instead of email since that's what the
// retailer actually has in hand on this page. Resolves the account's real
// email server-side and signs in with it; the client never needs to know
// or ask for the email at all.
export async function signInWithLicense(licenseNumberRaw: string, password: string): Promise<CartAuthResult> {
  const licenseNumber = licenseNumberRaw.trim();
  const user = await prisma.user.findFirst({ where: { role: "retailer", licenseNumber } });
  if (!user) return { ok: false, error: "No retailer account found for that license number." };
  if (user.mustChangePassword) {
    return { ok: false, error: "This account needs a new password set first." };
  }

  try {
    await signIn("credentials", { email: user.email, password, redirect: false });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Incorrect password." };
    }
    throw err;
  }
}

// Covers two cases with one function, since both end the same way (a real
// password now on file, then signed in): a genuinely new retailer
// (creates the account, mirroring lib/admin-retailer-assist.ts's
// createRetailerAccountForAdmin as closely as possible so this self-serve
// path and the Admin-assisted one stay consistent) — contactName/email
// are required here since a brand-new account needs both — or an existing
// account whose current password was set by an Admin/AE on the retailer's
// behalf (mustChangePassword), which just needs its password replaced.
// contactName/email are ignored for that second case — the account
// already has them.
export async function setNewPasswordForLicense(
  licenseNumberRaw: string,
  newPassword: string,
  opts: { contactName?: string; email?: string }
): Promise<CartAuthResult> {
  const licenseNumber = licenseNumberRaw.trim();
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findFirst({ where: { role: "retailer", licenseNumber } });
  const passwordHash = await bcrypt.hash(newPassword, 10);

  let email: string;
  if (existing) {
    if (!existing.mustChangePassword) {
      return { ok: false, error: "This account already has a password — sign in instead." };
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: false },
    });
    email = existing.email;
  } else {
    const contactName = (opts.contactName ?? "").trim();
    const emailInput = (opts.email ?? "").trim().toLowerCase();
    if (!contactName || !emailInput) {
      return { ok: false, error: "Name and email are required." };
    }
    const existingEmail = await prisma.user.findUnique({ where: { email: emailInput } });
    if (existingEmail) return { ok: false, error: "An account with that email already exists." };

    const match = await lookupLicense(licenseNumber, "retailer");
    if (!match.found) {
      return { ok: false, error: "No retailer license found for that number in the state registry." };
    }
    const autoApprove = !!match.isActive;
    const anonHandle = await generateAnonHandle("retailer");

    const created = await prisma.user.create({
      data: {
        role: "retailer",
        email: emailInput,
        fullName: contactName,
        businessName: match.businessName ?? null,
        passwordHash,
        anonHandle,
        licenseNumber,
        licenseVerification: autoApprove ? "approved" : "unverified",
        licenseAutoMatched: autoApprove,
        address: match.street ?? null,
        city: match.city ?? null,
        state: match.state ?? null,
        zip: match.zip ?? null,
        mustChangePassword: false,
      },
    });
    email = created.email;
  }

  try {
    await signIn("credentials", { email, password: newPassword, redirect: false });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Account saved, but sign-in failed — try signing in directly." };
    }
    throw err;
  }
}
