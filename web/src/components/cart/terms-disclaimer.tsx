// The liability disclaimer confirmed with the human (CLAUDE.md §40): a
// grower who agrees to something other than cash-on-delivery terms bears
// full responsibility for that choice, and the Account Executive who
// connected the parties is held harmless for it. Draft text, same
// "not yet attorney-reviewed" posture as every other legal-adjacent surface
// in this app (§18's non-circumvention agreement, §2's METRC caveats) —
// shown wherever an AE takes an action that could expose them (building a
// shareable menu/collection link) rather than tracked with a separate
// acceptance record the way the non-circumvent agreement is, to keep this
// lightweight for a first pass.
export const TERMS_DISCLAIMER_TEXT =
  "Smaller orders default to cash on delivery. A grower may choose to accept other payment terms (e.g. net-30) for an order placed through a link you shared — that is entirely the grower's own decision, and the grower bears full responsibility for whatever terms they agree to. As the Account Executive who built or shared this menu, you are not a party to the deal and are held harmless for the grower's choice of terms.";

export function TermsDisclaimer() {
  return (
    <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5">
      {TERMS_DISCLAIMER_TEXT}
    </p>
  );
}
