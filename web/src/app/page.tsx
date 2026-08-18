import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleHome } from "@/lib/constants";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { CapabilityStrip } from "@/components/marketing/capability-strip";
import { Flow } from "@/components/marketing/flow";
import { Xcelerate } from "@/components/marketing/xcelerate";
import { Roles } from "@/components/marketing/roles";
import { Compliance } from "@/components/marketing/compliance";
import { FinalCta, SiteFooter } from "@/components/marketing/cta-footer";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(roleHome(session.user.role));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />
      <Hero />
      <CapabilityStrip />
      <Flow />
      <Xcelerate />
      <Roles />
      <Compliance />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}
