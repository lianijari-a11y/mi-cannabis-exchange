"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { ingestMonthlyReport, deleteMonthlyReport } from "@/lib/monthly-report";
import { importLicenseRegistryCsv } from "@/lib/license-registry-import";

function fail(message: string): never {
  redirect(`/admin/data-uploads?error=${encodeURIComponent(message)}`);
}

export async function uploadMonthlyReport(formData: FormData) {
  const session = await requireRole("admin");
  const file = formData.get("report");
  if (!(file instanceof File) || file.size === 0) fail("Choose a .docx file.");

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  try {
    await ingestMonthlyReport(buffer, (file as File).name, session.user.id);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Couldn't parse this report.");
  }
  revalidatePath("/admin/data-uploads");
}

export async function removeMonthlyReport(formData: FormData) {
  await requireRole("admin");
  await deleteMonthlyReport(String(formData.get("id")));
  revalidatePath("/admin/data-uploads");
}

export async function uploadLicenseRegistryCsv(formData: FormData) {
  await requireRole("admin");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) fail("Choose a .csv file.");

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  let result: Awaited<ReturnType<typeof importLicenseRegistryCsv>>;
  try {
    result = await importLicenseRegistryCsv(buffer, (file as File).name);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Couldn't import this CSV.");
  }
  redirect(`/admin/data-uploads?imported=${result.imported}&skipped=${result.skippedUnknownCategory}`);
}
