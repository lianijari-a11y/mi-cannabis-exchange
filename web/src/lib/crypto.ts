import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

// Added alongside the Retailer POS module (CLAUDE.md §23) — the first place
// METRC/POS credentials stop being purely decorative (submitSaleToMetrc in
// lib/metrc-integration.ts makes a real call with them), so "not encrypted
// at rest yet" stopped being an acceptable posture for MetrcConnection.userApiKey
// and MetrcVendorConfig.vendorApiKey specifically. Deriving the AES key from
// NEXTAUTH_SECRET (already required, see .env.example) avoids provisioning a
// new secret. PosConnection.apiKey (Dutchie/Treez/Flowhub/Cova stub sync) is
// untouched — still no live calls, still not this feature.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1:";

function deriveKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt stored credentials.");
  return Buffer.from(
    hkdfSync("sha256", secret, "", "mi-cannabis-exchange:credential-encryption", 32)
  );
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

// Old MetrcConnection/MetrcVendorConfig rows created before this module
// existed are stored as plain text (no "v1:" prefix) — returned as-is rather
// than thrown on, so this isn't a breaking migration for whatever's already
// in the dev database. They get re-encrypted the next time that credential
// is saved (connectMetrc/setMetrcVendorApiKey always encrypt on write).
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) return stored;
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
