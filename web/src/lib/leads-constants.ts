// Pure constants/types shared between server (lib/leads.ts) and client
// (components/leads/leads-manager.tsx) code — kept out of lib/leads.ts so
// the client bundle never pulls in "server-only" + Prisma.

// Taino List (NY) is deliberately excluded — the human confirmed it's not
// used for this platform. MI Processors and MI Dispensaries are populated
// from the state's own CRA license exports (see CLAUDE.md §20), not from
// the source CRM tool's own export.
export const LEAD_LIST_KEYS = ["leads", "mi_processors", "mi_dispensaries"] as const;
export type LeadListKey = (typeof LEAD_LIST_KEYS)[number];

export const LEAD_LIST_LABELS: Record<LeadListKey, string> = {
  leads: "Lead Directory (MI)",
  mi_processors: "MI Processors",
  mi_dispensaries: "MI Dispensaries",
};

export const LEAD_DISPOSITIONS = [
  "NEW",
  "NO_PHONE",
  "NO_ANSWER",
  "BUSY",
  "CALLBACK",
  "EMAIL_SENT",
  "SALE",
  "DISCONNECTED",
  "DECLINED",
  "DNC",
] as const;
export type LeadDisposition = (typeof LEAD_DISPOSITIONS)[number];

export const LEAD_DISPOSITION_LABELS: Record<LeadDisposition, string> = {
  NEW: "New / Not Attempted",
  NO_PHONE: "No Phone Number",
  NO_ANSWER: "No Answer",
  BUSY: "Busy",
  CALLBACK: "Call Back",
  EMAIL_SENT: "Email Sent",
  SALE: "Sale",
  DISCONNECTED: "Disconnected",
  DECLINED: "Declined",
  DNC: "Do Not Call",
};
