import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/portal-shell";
import { ShareMenuLink } from "@/components/sales/share-menu-link";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/negotiations", label: "Negotiations" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminCollectionConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("admin");
  const { id } = await params;
  const collection = await prisma.menuCollection.findFirst({
    where: { id, salesRepId: session.user.id },
  });
  if (!collection) notFound();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <Link href="/admin/accounts" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to accounts
      </Link>
      <div className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-w-lg">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Link created</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {collection.batchIds.length} menu{collection.batchIds.length === 1 ? "" : "s"} bundled into
          one shareable link — anyone who opens it can browse and order from all of them.
        </p>
        <ShareMenuLink batchId={collection.id} path="collection" label="Share collection" />
      </div>
    </PortalShell>
  );
}
