import { redirect } from "next/navigation";

// The accounts list moved to /sales itself (the AE's actual landing page)
// so it's the first thing a rep sees, not a side tab easy to miss — see
// CLAUDE.md §38's follow-up. Kept as a redirect so any existing link/
// bookmark to this path still lands somewhere sensible.
export default function SalesAccountsRedirect() {
  redirect("/sales");
}
