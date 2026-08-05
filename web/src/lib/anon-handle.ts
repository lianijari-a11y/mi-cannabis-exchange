import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, type Role } from "@/lib/constants";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function randomCode(length = 3): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

// Stable anonymous handle shown across the blind-marketplace boundary, e.g.
// "Grower #A17". Retried on collision since it's a small alphabet — collisions
// are rare but not impossible as the user base grows.
export async function generateAnonHandle(role: Role): Promise<string> {
  const label = ROLE_LABELS[role] ?? "User";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${label} #${randomCode()}`;
    const existing = await prisma.user.findUnique({ where: { anonHandle: candidate } });
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback with a longer code.
  return `${label} #${randomCode(5)}`;
}
