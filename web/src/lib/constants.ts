export const ROLES = ["grower", "processor", "retailer", "broker", "transporter", "admin"] as const;
export type Role = (typeof ROLES)[number];

// Roles that can post inventory listings.
export const SELLER_ROLES = ["grower", "processor", "broker"] as const;
export type SellerRole = (typeof SELLER_ROLES)[number];

// Roles that hold a state cannabis license and go through Admin verification.
// Transporter maps to Michigan's Secure Transporter license category.
export const LICENSED_ROLES = ["grower", "processor", "retailer", "transporter"] as const;

// Roles that need a pickup/delivery address on file.
export const ADDRESS_ROLES = ["grower", "processor", "retailer"] as const;

export const CATEGORIES = [
  "flower",
  "concentrate",
  "vape",
  "edible",
  "pre_roll",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  flower: "Flower",
  concentrate: "Concentrate",
  vape: "Vape",
  edible: "Edible",
  pre_roll: "Pre-Roll",
  other: "Other",
};

export const UNITS = ["lb", "liter", "unit"] as const;
export type Unit = (typeof UNITS)[number];

export const TERMS = ["cash", "net_30", "negotiable"] as const;
export type Terms = (typeof TERMS)[number];

export const TERMS_LABELS: Record<Terms, string> = {
  cash: "Cash",
  net_30: "Net 30",
  negotiable: "Negotiable",
};

// How long a listing stays visible in the retailer feed before it auto-expires.
// hours: null means no expiration.
export const EXPIRATION_OPTIONS: { hours: number | null; label: string }[] = [
  { hours: 24, label: "24 hours" },
  { hours: 24 * 3, label: "3 days" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 14, label: "14 days" },
  { hours: null, label: "No expiration" },
];

export const ROLE_LABELS: Record<Role, string> = {
  grower: "Grower",
  processor: "Processor",
  retailer: "Retailer",
  broker: "Broker",
  transporter: "Transporter",
  admin: "Admin",
};

export const SHIPMENT_STATUSES = ["assigned", "picked_up", "in_transit", "delivered"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  assigned: "Assigned",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
};

// The status a transporter can move a shipment to next — one step at a time,
// no skipping ahead or going backward.
export const NEXT_SHIPMENT_STATUS: Record<ShipmentStatus, ShipmentStatus | null> = {
  assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

export function roleHome(role: string): string {
  switch (role) {
    case "grower":
      return "/grower";
    case "processor":
      return "/processor";
    case "retailer":
      return "/retailer";
    case "broker":
      return "/broker";
    case "transporter":
      return "/transporter";
    case "admin":
      return "/admin";
    default:
      return "/login";
  }
}
