import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/portal-shell";
import { ShareMenuLink } from "@/components/sales/share-menu-link";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

export default async function CollectionConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("sales_rep");
  const { id } = await params;
  const collection = await prisma.menuCollection.findFirst({
    where: { id, salesRepId: session.user.id },
  });
  if (!collection) notFound();

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to my accounts
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
