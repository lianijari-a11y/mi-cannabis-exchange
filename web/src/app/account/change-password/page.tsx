import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/app/actions";
import { userMustChangePassword } from "@/lib/account-management";
import { roleHome } from "@/lib/constants";
import { ChangePasswordForm } from "./change-password-form";

// The forced-change gate lib/dal.ts's requireRole/requirePosAccess/
// requireAuth redirect to. Deliberately does NOT call any of those
// helpers itself (they'd redirect right back here — this page has to
// check auth() directly). A user who lands here without actually needing
// to (mustChangePassword already false — e.g. they used the browser's
// back button after already changing it) gets sent on to their normal
// role home instead of being stuck.
export default async function ForcedChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const needsChange = await userMustChangePassword(session.user.id);
  if (!needsChange) redirect(roleHome(session.user.role));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Set a new password</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              An Admin or Account Executive set your current password for you — choose one only you
              know before continuing.
            </p>
          </div>

          <ChangePasswordForm />

          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 dark:text-gray-400 underline w-full text-center">
              Sign out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
