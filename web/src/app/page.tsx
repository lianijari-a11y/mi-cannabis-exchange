import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, Sprout, FlaskConical, Store, Handshake } from "lucide-react";
import { auth } from "@/auth";
import { roleHome } from "@/lib/constants";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(roleHome(session.user.role));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            MI Cannabis Exchange
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-gray-600 dark:text-gray-300">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-gray-100 max-w-2xl">
          A blind wholesale exchange for Michigan-licensed cannabis
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-xl">
          Growers, processors, and brokers post inventory. Every retailer sees it instantly.
          Negotiate price and terms back and forth — cash or net-30 — without either side ever
          knowing who's on the other end. A neutral broker sees the whole conversation and
          handles what happens next.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PortalCard
            icon={<Sprout className="w-5 h-5" />}
            title="Grower"
            body="Post flower inventory with photos, THC%, and your terms. Instantly visible to every retailer."
          />
          <PortalCard
            icon={<FlaskConical className="w-5 h-5" />}
            title="Processor"
            body="List concentrates, vapes, and edibles by the unit or liter, same instant visibility."
          />
          <PortalCard
            icon={<Store className="w-5 h-5" />}
            title="Retailer"
            body="Browse every active listing anonymized. Accept as-is or counter on price and terms."
          />
          <PortalCard
            icon={<Handshake className="w-5 h-5" />}
            title="Broker"
            body="See every negotiation on the platform, in real identity, from your phone."
          />
        </div>
      </main>
    </div>
  );
}

function PortalCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-3 font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{body}</p>
    </div>
  );
}
