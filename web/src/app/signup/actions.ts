"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { ROLES, LICENSED_ROLES, ADDRESS_ROLES, roleHome, type Role } from "@/lib/constants";

export type SignupState = { error?: string } | undefined;

const SIGNUP_ROLES: Role[] = ["grower", "processor", "retailer", "broker", "transporter"];

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const roleRaw = String(formData.get("role") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!ROLES.includes(roleRaw as Role) || !SIGNUP_ROLES.includes(roleRaw as Role)) {
    return { error: "Choose an account type." };
  }
  const role = roleRaw as Role;

  if (!fullName || !email) {
    return { error: "Name and email are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  let licenseNumber: string | null = null;
  let licenseType: string | null = null;
  let licenseExpiry: Date | null = null;
  if (LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number])) {
    licenseNumber = String(formData.get("licenseNumber") ?? "").trim() || null;
    licenseType = String(formData.get("licenseType") ?? "").trim() || null;
    const licenseExpiryRaw = String(formData.get("licenseExpiry") ?? "").trim();
    licenseExpiry = licenseExpiryRaw ? new Date(licenseExpiryRaw) : null;
    if (!licenseNumber) {
      return { error: "State license number is required for this account type." };
    }
  }

  let address: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  if (ADDRESS_ROLES.includes(role as (typeof ADDRESS_ROLES)[number])) {
    address = String(formData.get("address") ?? "").trim() || null;
    city = String(formData.get("city") ?? "").trim() || null;
    state = String(formData.get("state") ?? "").trim() || null;
    zip = String(formData.get("zip") ?? "").trim() || null;
    if (!address || !city || !state || !zip) {
      return { error: "A full pickup/delivery address is required for this account type." };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const anonHandle = await generateAnonHandle(role);

  await prisma.user.create({
    data: {
      role,
      email,
      fullName,
      businessName: businessName || null,
      passwordHash,
      anonHandle,
      licenseNumber,
      licenseType,
      licenseExpiry,
      licenseVerification: LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number])
        ? "unverified"
        : "approved",
      address,
      city,
      state,
      zip,
    },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: roleHome(role) });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created — sign in from the login page." };
    }
    throw err;
  }
}
