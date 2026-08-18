import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      // Only set for role = budtender — the Retailer account whose POS
      // they operate. See lib/dal.ts's requirePosAccess, CLAUDE.md §33.
      retailerOwnerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    retailerOwnerId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    retailerOwnerId: string | null;
  }
}
