# MI Cannabis Exchange — Build Brief for Claude Code

Read this before writing code. This is a **separate business from LaneMatch** (a freight-matching platform built elsewhere) — do not reuse its compliance model, only its engineering conventions.

---

## 1. What this is

A wholesale marketplace connecting five Michigan-licensed cannabis roles:

- **Grower** — cultivates flower, posts inventory
- **Processor** — makes concentrates/edibles/vapes, posts inventory
- **Retailer** — buys wholesale inventory to sell at retail
- **Broker** — the platform's own intermediary; mediates every deal
- **Transporter** — Michigan Secure Transporter-licensed carrier; hauls an accepted deal from Grower/Processor to Retailer once the retailer has accepted the seller's invoice

A Grower, Processor, or Broker can post an inventory listing. It becomes **immediately visible** to every Retailer (a bulletin-board model, not a platform-assigned match). A Retailer can accept a listing as posted, or counter-offer on price and/or payment terms (cash vs. 30-day terms are both negotiable). The Grower/Processor can then accept, reject, or counter back — this can go back and forth an arbitrary number of rounds. The Broker sees **every** negotiation across the whole platform, on both sides, in real identity — Retailer and Grower/Processor never see each other's identity, even after a deal closes.

Once a deal is accepted, fulfillment kicks off: the seller uploads an invoice, the retailer reviews it and accepts, which triggers transporter selection (the platform's preferred transporter is pre-selected, but the retailer can pick any other approved transporter) and creates a trackable shipment. See §3's 4th decision and §4's Transporter section.

## 2. The compliance wrinkle — read before touching identity/broker code

This was flagged, not silently decided, when the product shape was defined:

- Michigan requires **METRC seed-to-sale manifests** for any real transfer of licensed product, and a manifest names actual licensees (license number, business name) on both sides.
- It is **not established** that "broker" is a recognized standalone license category for wholesale cannabis transfers the way it is for real estate or (per FMCSA) freight — the Marihuana Regulation and Taxation Act (MRTA) and Medical Marihuana Facilities Licensing Act (MMFLA) license Growers, Processors, Retailers, Secure Transporters, Safety Compliance Facilities, Microbusinesses, etc. Whether an entity that never holds/transports product but sits between every deal and knows both identities needs its own license, or needs to operate under a Retailer/licensed-transporter's authority, is a real open legal question.
- **Do not resolve this in code or in this document.** The app is built so the Broker role has full visibility (matching the confirmed product decision), but the actual legal structure the platform owner operates under — a licensed entity, a partnership with one, a pure software-only "provides negotiation tooling, a licensed transporter completes the physical/METRC transfer" model, etc. — needs review by a Michigan cannabis attorney before this goes live with real product. Flag this to the human if asked to build real METRC integration or anything that implies the platform itself is executing a transfer.
- Until that's resolved, treat `Deal` records in this app as **negotiated agreements**, not completed legal transfers — the actual license-to-license transfer and METRC manifest happen outside this software, initiated by the Broker.
- The same caveat applies to `Shipment`/invoice records added for fulfillment: an uploaded invoice, an accepted invoice, and a transporter's "delivered" status update are **operational tracking inside this app**, not a substitute for the real METRC manifest and physical secure-transport paperwork a licensed transporter is separately obligated to keep. Don't build anything that implies this app's shipment record *is* the legal transfer record.

## 3. The three product decisions that shape the architecture

1. **Blind marketplace, identity never revealed between Grower/Processor and Retailer** — not before a deal, not after. Every API endpoint scoped to those two roles must never join to or expose the counterparty's `User` row. Enforce this at the query layer, not just in the UI — the UI hiding a field is not enough if the API response includes it.
2. **Broker sees every deal, platform-wide** — Brokers are not independent competing agents each with their own book of business; every broker user can see every active negotiation and every closed deal, with both real identities. This models the Broker as the marketplace operator's own staff/agents, not third-party brokers competing on the platform.
3. **First-to-accept / no platform-assigned matching** — a listing is visible to every Retailer simultaneously; nothing in the matching/feed logic should rank or gate listings based on the platform's own business interest. (This mirrors LaneMatch's load-board reasoning even though the legal basis here is different — it's just good practice for a bulletin-board model.)
4. **Transporter identity is real, not anonymized, and the retailer picks the transporter.** Confirmed with the human when the fulfillment flow was added: once a deal moves to shipping, the Transporter sees both the Grower/Processor's and Retailer's real business name and address (same trust tier as the Broker — needed for pickup/delivery logistics and matches how MI's Secure Transporter licensing already implies manifest-level detail on both parties). This does **not** loosen decision #1 — Grower/Processor and Retailer still never see *each other's* identity; they each separately see the Transporter's real identity, because a shipping carrier isn't the counterparty the blind-marketplace rule is protecting. Transporter selection happens when the retailer accepts the seller's invoice: the platform's preferred transporter (`User.preferredTransporter`, admin-set) is pre-selected, but any other approved Transporter account can be chosen instead — this is a self-serve role like the others, not a closed vendor list.

If you find yourself building something that would let the platform pick which Retailer gets a listing, or would let a Grower/Processor and Retailer see each other's identity, stop and flag it.

## 4. Roles and core functionality

### Grower / Processor
- Profile: business name, state license number, license type, license verification status (set by Admin)
- Post inventory listings: strain/product name, category (flower / concentrate / vape / edible / pre-roll / other), THC%, quantity + unit (lbs for flower/processed weight, liters for liquid concentrate/oil), price per unit, payment terms offered (cash / net-30 / negotiable), expiration, photos and videos
- **AI-assisted quick upload**: sellers post multiple times a day, often for very different products, so the listing form has a "paste your notes, structure with AI" step (`lib/ai-listing.ts`, Anthropic API) that turns raw pasted text into a pre-filled draft of the fields above. The seller always reviews and submits the draft themselves — the model drafts, it never posts a listing on its own (same AI-governance posture as the rest of this brief: recommend, don't act autonomously).
- View incoming offers/counters on their listings, respond (accept / reject / counter)
- Listings list, sortable/filterable by status
- **Post-acceptance**: once a deal is accepted, upload an invoice (image/PDF) against it. The retailer's side stays anonymized (still shown only as their anon handle) until/unless a shipment exists, at which point the seller also sees the real Transporter's name and the shipment status timeline (see §3 decision #4)

### Transporter
- Profile: business name, state license number/type (Secure Transporter), license verification status (set by Admin) — same self-serve signup + Admin approval gate as Grower/Processor/Retailer
- Dashboard: every shipment assigned to them, with the deal's real Grower/Processor and Retailer business name + address (needed for pickup/delivery), product/quantity/price/terms
- Update shipment status one step at a time: `assigned → picked_up → in_transit → delivered`, optionally with a note each step; delivery requires uploading a proof-of-delivery photo/PDF
- Does **not** see the negotiation history or listing feed — only shipments assigned to them

### Retailer
- Browse a feed of **all active listings** platform-wide, from every Grower/Processor/Broker poster — poster shown only as an anonymous handle (e.g. "Grower #A17"), never a real business name
- Filter/sort by category, strain, THC%, price, terms
- **Presentation is standardized**: every listing renders through one shared product-card component (`components/retailer/listing-card.tsx`) regardless of how rough the seller's original upload was — same layout, same badge placement, same typography — so the feed reads as one consistent catalog, not a pile of ad hoc posts
- Accept a listing as-is, or counter-offer (price and/or terms) — negotiation is a back-and-forth thread, anonymized on both sides
- See their own open/closed negotiation threads
- **Post-acceptance**: review the seller's uploaded invoice, then accept it and pick a transporter (preferred one pre-selected, any other approved transporter selectable) — this creates the shipment. From here the seller stays anonymized as always, but the chosen Transporter's real name and shipment status timeline are shown

### Broker
- Platform-wide dashboard: every active negotiation and every closed deal, in real identity on both sides (business name, license info)
- No action needed to "join" a deal — visibility is automatic and total, per decision #2 above
- Deal/negotiation status at a glance; this view is explicitly mobile-first (per the original brief: "broker sees all interactions on his phone app")
- Deal cards also show invoice/shipment status and the assigned transporter once fulfillment starts

### Admin
- License verification queue: review a submitted license number/type per user, approve/reject — this now gates Transporters too, not just Grower/Processor/Retailer
- User list/status
- Toggle which Transporter account is the platform's preferred default (`User.preferredTransporter`)

## 5. Negotiation state machine

One thread per (listing, retailer) pair. Each round is one of: `offer` (initial, implicit from the listing itself), `counter` (either side), `accept`, `reject`. A thread is `open` until an `accept` (→ creates a `Deal`) or a `reject` from either side, or the listing/thread expires. Either side can counter as many times as they want while open. All of this is visible to the Broker in real identity; visible to the two negotiating parties only in anonymized form.

Post-acceptance fulfillment is a second, simpler state machine on the `Deal`: no invoice → invoice uploaded → invoice accepted (creates the `Shipment`). The `Shipment` itself steps one-way through `assigned → picked_up → in_transit → delivered`, advanced only by the assigned Transporter (`lib/shipments.ts` `advanceShipmentStatus`, using `NEXT_SHIPMENT_STATUS` — no skipping ahead or reverting).

## 6. Data model

See `web/prisma/schema.prisma` — `User` (role: grower/processor/retailer/broker/transporter/admin, license fields, `address`/`city`/`state`/`zip` for grower/processor/retailer, `preferredTransporter` flag), `Listing`, `ListingMedia`, `OfferThread` + `OfferRound`, `Deal` (now with `invoiceUrl`/`invoiceUploadedAt`/`invoiceAcceptedAt`), `Shipment` + `ShipmentEvent`. The anonymization boundary is enforced in `web/src/lib/listings.ts` and `web/src/lib/offers.ts` — those modules are the only places allowed to query across the Grower/Processor ↔ Retailer boundary, and they must never return the counterparty's real `User` fields to a non-broker, non-admin, non-assigned-transporter caller. `web/src/lib/shipments.ts` owns the invoice/shipment logic and is the one place allowed to resolve a Deal's real seller/retailer identity out to the assigned Transporter.

## 7. Stack

Next.js 16, Prisma (SQLite for local dev — zero external setup; swap to Postgres via `DATABASE_URL` when a hosted DB is provisioned, same as LaneMatch's Supabase setup), NextAuth v5 (credentials), Tailwind v4, TypeScript. Local disk storage for photo/video uploads during development (`public/uploads/`) — swap for real object storage (S3/Supabase Storage/Cloudinary) before production; note this in code as a follow-up, don't silently pretend it's production-ready. Anthropic API (`ANTHROPIC_API_KEY`) powers the AI quick-upload draft feature (`lib/ai-listing.ts`) — unset by default, feature falls back to a plain "fill in by hand" message.

## 8. Deferred — circle back before real launch

- Real object storage/CDN for media (currently local disk)
- `ANTHROPIC_API_KEY` not set by default — AI quick-upload structuring is a no-op fallback until the platform owner adds a key
- METRC manifest generation/integration — **blocked on the legal question in §2**
- SMS/push/email notifications — §10 added in-app-only notifications (offer viewed, countered, accepted/rejected); Brokers still get nothing pushed to them outside the app
- Payment/invoicing automation for net-30 terms (this app tracks the *agreed* terms, it doesn't move money)
- Real license verification (currently a manual Admin approve/reject, no FMCSA-SAFER-style automated check exists for MI cannabis licenses the way it does for DOT authority)
- Legal review of the Broker's licensing/liability structure (§2) — do not build around an assumption here without that review
- No live GPS/location tracking for shipments yet — status is transporter-reported (assigned/picked up/in transit/delivered), not automatic. A real ELD/GPS integration is a natural Phase 2, same spirit as LaneMatch's Motive/Samsara integration
- No address validation/geocoding on the signup address fields — free text for now
- Invoice/POD documents are stored on local disk like listing media — same production storage caveat applies
- `SplitContract` (§10) fulfillment isn't wired into `Shipment`/Transporter — settled toll-processing contracts have no tracked pickup/transport step and no METRC-equivalent trail, same underlying gap as §2

## 9. Things to flag back to the human, not decide silently

- Anything implying the platform itself completes a legal cannabis transfer (vs. facilitating negotiation up to an agreed `Deal`)
- Any change that would let Grower/Processor and Retailer see each other's identity
- Any change that would let the platform algorithmically choose which Retailer gets a listing
- Legal template content for any agreement drafted in-app — should come from an actual MI cannabis attorney
- **Broker commission exists now — see §11.** This section originally said the platform never takes a commission; that stance was deliberately reversed on 2026-08-16 with the human's explicit confirmation after being shown the legal tradeoff (see §11). Left here, struck through in spirit rather than deleted, so nobody assumes the no-commission rule is still in force just because §9 is the "flag, don't decide silently" section — the decision *was* surfaced, and the human chose to proceed. `SplitContract` settlements still take no platform cut — that piece of the original stance is unchanged.

## 10. Market intelligence, alerts, and toll-processing (added 2026-08-16)

Built after the initial build brief, evaluated against a reference prototype shared by the human — see §9's note on what was deliberately *not* ported from it.

- **Market Pulse** (`lib/market.ts`) — average asking price by category across active listings, shown on the retailer feed and every seller dashboard. Computed live from this platform's own data, not a third-party report.
- **Sold comps** (`lib/market.ts`) — recent closed `Deal`s in the same category, shown on a listing's detail page.
- **Seller rating** (`lib/market.ts`) — a star score derived from what fraction of a seller's past deals actually reached `delivered`. New sellers with no closed deals get no score rather than a fabricated default. On the retailer side this is resolved by `sellerRatingForListing(listingId)`, which never exposes the real `sellerId` to the caller — same anonymization boundary as everywhere else.
- **License expiration alerts** (`lib/admin.ts`) — Admin dashboard flags any licensed user (`User.licenseExpiry`) expiring within 90 days, or already expired.
- **Watchlist** — a retailer can track a listing without making an offer on it (`Watchlist` model, `lib/watchlist.ts`), with a dedicated `/retailer/watchlist` page.
- **Offer view tracking + in-app notifications** — `OfferThread` now tracks a view count and last-viewed timestamp per side (`lib/offers.ts`'s `recordThreadView`); the *other* party gets a throttled (max once per 10 min) notification that their offer was viewed, plus notifications on counter/accept/reject. This is the achievable slice of §8's deferred "SMS/push to Brokers" item — **in-app only**, no SMS/push/email, surfaced via a bell icon in `components/notification-bell.tsx` on every portal.
- **Auto-generated invoice** (`lib/invoice.ts`) — an invoice used to require the Grower/Processor to manually upload a file before the Retailer could accept and move to fulfillment; now one is auto-generated the instant a `Deal` is created (`Deal.invoiceAutoGenerated`), rendered at `/deal/[id]/invoice`, so the Retailer is never blocked. The seller can still upload their own file to override it — same anonymization rule as everywhere else: each party's own side is real, the counterparty is only ever shown as their `anonHandle` (Broker/Admin see both real). **Real accounting-platform integration is intentionally not built yet** — the human has a separate, more mature project (`ai-ledger`, an AI accounting/tax platform with a real `Invoice`/`Customer`/`ApiKey` data model) they want this to eventually hand off to for real payment processing via a cannabis-friendly bank. That integration is deferred until (a) `ai-ledger`'s own concurrent-session lock clears — see its CLAUDE.md §9, two sessions collided there once already — and (b) its actual invoice-creation API surface is understood. The in-app auto-generated invoice is meant to be the always-working default; the `ai-ledger` connection becomes a selectable option layered on top, not a replacement.
- **Toll-processing / split contracts** (`lib/split-contracts.ts`) — a Processor can source a Grower's raw listing not for a flat price, but for a % share of the finished product's eventual value (`SplitContract` model). Flow: Processor browses `/processor/sourcing` (active Grower listings only) and proposes a split; Grower accepts/rejects from their listing detail page (same anonymized-handle pattern as regular offers); once accepted the listing closes like a normal `Deal` would; Processor logs a yield once processing is done, then either party keys in a settlement value and the split is computed — **the platform takes no cut of this**, unlike §11's `Deal` commission below. Deliberately simpler than the price/terms negotiation state machine: single propose → accept/reject, no counter-offer loop. Physical pickup/transport for a settled contract is coordinated directly between Grower and Processor for now — it is **not** wired into the `Shipment`/Transporter flow yet, which means (like the rest of this app, see §2) it produces no METRC-equivalent paper trail. That's a deferred follow-up, not a solved problem — add it to §8 if picked up.
- **Product acceptance after delivery** (`lib/commission.ts`'s `acceptProduct`/`rejectProduct`) — once a `Shipment` reaches `delivered`, the Retailer gets an explicit accept/reject step (`Deal.productStatus`). Accepting shows a "this transaction is final, no in-app dispute process" notice before it's confirmed, and is the trigger that computes any commission amount owed (§11). Rejecting is only *recorded* — the app does not run a refund/return/dispute workflow; that's real-world, off-platform, same caveat as §2's transfer language.

## 11. Broker commission (added 2026-08-16 — reverses §9's original no-commission stance)

**This was a confirmed, explicit reversal, not a silent decision.** The human was shown the exact tradeoff — commission is the pattern that makes the platform look like a broker taking a cut of a cannabis transfer, sharpening §2's still-open "is broker a recognized MI license category" question rather than staying clear of it — and chose to proceed anyway. If a future session is asked to touch commission logic and something about it seems inconsistent with the blind-marketplace/no-transfer posture elsewhere in this doc, that's expected: this section is a deliberate carve-out, not an oversight to "fix" back to the original stance.

- **Any broker can set commission terms on any `Deal`** (`lib/commission.ts`'s `setCommission`) — same platform-wide visibility as everything else a broker sees (decision #2). Terms: a **rate from 0-100%, entirely the broker's own judgment call per deal** — there is no platform-default or preset band; the only ceiling is the mathematical one (can't take more than the deal is worth). Payer is also broker-chosen: grower pays, retailer pays, or split by a broker-chosen grower/retailer percentage.
- **The dollar amount is computed once, at product acceptance** (§10's `acceptProduct`), not before — a broker can freely edit rate/payer terms any time before that point without anything downstream depending on the old number. After computation, editing terms does *not* silently recalculate — see the comment in `setCommission`.
- **Tracked, not processed.** `Commission.status` goes `pending` → `paid` via a manual broker (or Admin) action (`markCommissionPaid`) — this app never moves money itself, same as every other dollar figure here (§8). No card processing, no ACH, nothing programmatic.
- Real payment rails (the human's separate `ai-ledger` project, connected to a cannabis-friendly bank) are the eventual path for actually *collecting* commission — same deferred-integration status as §10's invoice section.

## 12. License registry auto-populate + auto-approval, and a relaxed posting gate (added 2026-08-16)

Two related changes, both requested by the human directly:

- **The state license number lookup is real now, not just admin-manual review.** `LicenseRegistry` (`web/prisma/schema.prisma`) holds ~3,300 rows imported from the state of Michigan's own CRA license exports (5 files: Class B Grower, Class C Grower, Processor, Retailer, Secure Transporter — no Broker category exists in the state data, which is exactly §2's still-open question, not resolved here) via `scripts/parse-license-csvs.mjs` + `scripts/import-license-registry.mjs`. At signup, entering a license number triggers `lib/license-registry.ts`'s `lookupLicense` (exposed to the client via `/api/license-lookup` for live autofill, and re-run independently server-side in `signup/actions.ts` — the client's autofill is never trusted for the actual decision) which auto-fills business name and address, and — **only if the state's own status for that record is exactly `"Active"`** — sets `licenseVerification: "approved"` immediately instead of leaving it `"unverified"` for the Admin queue. Anything else (no match, `"License Void"`, `"Closed - Suspended"`, `"Revoked"`) falls back to the existing manual Admin review, unchanged.
- **This is tracked as a distinct thing from a real Admin approval, on purpose.** `User.licenseAutoMatched` is `true` only when the license was auto-approved this way. The honest caveat, stated plainly rather than glossed over: matching a license *number* is not proof that the person typing it in actually owns or represents that license — MI license numbers are largely public record. Auto-matched accounts show a distinct "auto-matched" badge in Admin's user list (`/admin`) precisely so a human retains an audit trail and can revoke one if something looks off, even though it wasn't blocking anyone up front. Don't quietly turn this into "auto-matched == verified" anywhere in the UI — the badge exists so nobody makes that mistake.
- **Phone-number enrichment from the platform owner's own lead list is not done yet.** The human has a separate CRM tool with a "Lead Directory (MI)" list carrying phone numbers for many of these same businesses, but it uses a completely different license-number scheme than the state exports (confirmed by spot-checking — same company, different numbers), so the only reliable join key is business name, and that list was only available as a chat-pasted blob, not a file — hand-transcribing hundreds of records from that risked attaching the wrong phone number to the wrong business, so it was deliberately skipped rather than done sloppily. If picked back up: get the Lead Directory as an actual CSV/JSON export (the tool has an Export button) and add a name-matching merge pass that fills `LicenseRegistry.phone`.
- **The listing/offer posting gate was relaxed** (`lib/seller-actions.ts`, `lib/retailer-actions.ts`, `lib/processor-actions.ts`) — previously `licenseVerification !== "approved"` blocked posting/offering entirely while pending review; now only `licenseVerification === "rejected"` blocks it, so a normal `"unverified"` (pending Admin, or pending a registry match that didn't auto-approve) account can still post listings and make/respond to offers immediately. **This was not extended to transporter shipment assignment** (`lib/shipments.ts` still requires `"approved"` to be selected as a deal's transporter or show up as the default) — that's a physical-dispatch decision, not what was asked to loosen, and it's a different risk tier than posting inventory or negotiating a price.

## 13. Sales Rep role, shipment scheduling, freshness nudges, and a real post-rejection workflow (added 2026-08-16)

A batch of workflow requests, walked through and implemented together:

- **New role: Sales Rep** (`sales_rep`, `lib/sales-actions.ts`). Same trust tier as Broker — sees real Grower/Processor identity, not a licensed cultivator themselves (not in `LICENSED_ROLES`/`ADDRESS_ROLES`). Solicits an inventory list from a grower/processor off-platform, then builds it into a listing at `/sales/listings/new` using a seller search (`SellerPicker` component, `searchAssistableSellers`) — the listing posts under the **chosen seller's own identity** (`Listing.postedById`), with `Listing.createdBySalesRepId` as a pure audit trail, never shown to buyers. **Admin got the identical capability** (`/admin/listings/new`, same underlying `handleCreateListingAsAssistant`) per an explicit follow-up ask — one shared function, two entry points, gated separately by `requireRole("sales_rep")` / `requireRole("admin")` in each page's own search-action file.
- **Growers can still post their own menus directly, unchanged** — Sales Rep/Admin assistance is additive, not a replacement path.
- **Shipment scheduling** (`Shipment.scheduledPickupAt/scheduledDeliveryAt/growerAcceptedSchedule/retailerAcceptedSchedule`, `lib/shipments.ts`'s `proposeShipmentSchedule`/`acceptShipmentSchedule`). The transporter proposes a pickup/delivery window from their shipment detail page; the grower and retailer each accept it separately from their own deal panel (`ScheduleAcceptPanel`). `advanceShipmentStatus` now **blocks the assigned → picked_up transition** until both have accepted, but only if a schedule was ever proposed — deals that skip scheduling entirely aren't gated, so this stays backward compatible. Re-proposing a new time resets both acceptance flags.
- **Retailers get a "Not interested" dismiss button** (`ListingDismissal` model, `lib/dismissals.ts`, `DismissButton` component) alongside Watchlist — hides a listing from that retailer's own feed only, reversible, never affects what anyone else sees. This is a per-viewer feed filter, not a change to the listing itself, so it doesn't touch decision #3's bulletin-board rule.
- **Listing freshness nudges** (`Listing.lastConfirmedAt`, `lib/listings.ts`'s `confirmListingFresh`). Sellers post multiple times a day and stale listings degrade the feed, so: the retailer feed flags anything not confirmed available in 3+ days ("Not confirmed in Nd"), offers a "Recently confirmed available" sort, and the seller's own dashboard/listing-detail page shows the same staleness plus a one-click "Still available? Confirm" button that bumps `lastConfirmedAt`. **No actual push/email reminder** — there's no background-job infra in this app (same gap as §8's deferred SMS/push item), so this is informational-on-view only, not a proactive nudge sent to anyone.
- **Post-rejection now has a real in-app workflow**, not just a recorded dead-end (`ProductRejection` model, `lib/commission.ts`'s `chooseReturn`/`proposeRejectionCounter`/`acceptRejectionCounter`/`requireReturnInsteadOfCounter`). Rejecting delivery now **requires a reason**. The retailer then picks one of two paths: send the product back outright, or propose a revised price reflecting its condition. The grower either accepts the revised price (the deal closes at the new `finalPrice`) or insists on the return. Single round, no back-and-forth counter loop — same "deliberately simpler" scope cut as `SplitContract`. **This still is NOT a refund/payment/return-shipping engine** — the resolution is tracked, the actual physical return and any money movement stay off-platform, same caveat as §2/§8 everywhere else in this doc. Don't let "there's now a workflow" get read as "this app handles returns."

## 14. Negotiated rejection fee (added 2026-08-16)

Distinct from §11's broker commission on purpose: this is a term the **buyer and seller negotiate themselves**, during their own offer/counter rounds (`OfferRound.rejectionFeeRate`/`rejectionFeePayer`) — not something a broker sets after the fact. Confirmed with the human: the fee is a % of deal value, freely negotiated like price (no platform-wide default rate), while the *payer* defaults to a 50/50 split if the parties never discuss it (either side can propose grower-pays/retailer-pays/split instead, same as they'd counter on price). Resolved onto `Deal.rejectionFeeRate`/`rejectionFeePayer` at acceptance the same way `finalPrice` is. The actual dollar amount is computed at rejection time (`lib/commission.ts`'s `rejectProduct`, stored on `ProductRejection.feeAmount`/`feeGrowerOwes`/`feeRetailerOwes`) since that's the event that triggers it — a rate of 0 (never negotiated) means no fee at all. Tracked via `feeStatus`/`markRejectionFeePaid` (broker or admin marks it settled), same "this app never moves money" posture as Commission (§8/§11) — no card processing, no ACH.

## 15. Cross-role ratings (added 2026-08-16)

Extends the existing seller rating (§10's `sellerRating`) to every role, same honesty rule throughout: **no fabricated default for someone with no history yet** — a user with zero relevant deals/shipments shows no score, not a made-up middling one.

- **Retailer rating** (`lib/market.ts`'s `retailerRating`) — this app doesn't process real payment (§8), so "pays on time" is proxied by how fast a retailer accepts the invoice once it's on file (the fastest real signal actually available), combined with how often their deals end in a rejected delivery. Surfaced to the seller, per-thread, via `retailerRatingForThread` — resolves through a `threadId` so the seller-side caller never has to be handed `retailerId` directly, same anonymization-boundary pattern as `sellerRatingForListing`.
- **Transporter rating** (`transporterRating`) — % of shipments delivered on/before their scheduled window (§13), among shipments that actually had one proposed; falls back to plain delivery-completion rate when no schedule was ever used, so adopting §13's scheduling feature isn't a prerequisite for having a score at all.
- All three (seller/retailer/transporter) shown together in Admin's user list (`/admin`) as a single "Rating" column — the one place every role's score is visible side by side.

## 16. Market pricing trend (added 2026-08-16)

Extends §10's Market Pulse (average asking price by category) with a trend direction — `lib/market.ts`'s `priceTrend` buckets **closed Deals** (actual sold prices, not asking prices) by week and compares the oldest to the newest bucket in an 8-week window. Shown as a small ↑/↓/→ arrow with a % change next to each category in the existing `MarketPulse` widget (retailer feed + every seller dashboard) — deliberately just numbers, no charting library pulled in for one widget.

## 17. Explicitly deferred, not silently decided — flagged mid-build (2026-08-16)

The human asked for admin-driven listing approval plus the option to make a listing exclusive to one specific buyer. **The second half was not built.** Restricting a listing to one retailer, chosen by the platform (Admin/Broker) rather than by the seller themselves, is exactly what decision #3 and its "if you find yourself building something that would let the platform pick which Retailer gets a listing, stop and flag it" line describe — this was flagged back to the human instead of built, per that instruction, and the human's response was to not proceed for now. If picked back up: the distinction that matters is *who* makes a listing exclusive — the seller restricting their own inventory to a buyer they already have a relationship with doesn't touch the bulletin-board rule; the platform choosing a winner does. Admin listing pre-approval (a moderation gate before anything goes live at all) is a separate, likely fine, question that also hasn't been built yet — it stalled alongside the exclusivity question rather than being decided independently.

**Update, later the same day (2026-08-16): re-asked, and reversed.** The human raised admin-controlled listing exclusivity a second time. Flagged again, explicitly, with the same decision #3 conflict spelled out — and this time the human confirmed they want it built. See §18's listing distribution entry for what actually shipped. Left this paragraph as written above rather than edited, same "show the reversal, don't erase the original stance" posture as §11.

## 18. Second feature batch — sales/market-data tooling, wanted board, listing distribution, and a non-circumvention agreement (added 2026-08-16)

A large batch of follow-up requests, walked through and implemented together. Grouped here by theme rather than chronologically.

**Market/license data ingestion**
- **Monthly Michigan CRA "Monthly Report" upload** (`lib/monthly-report-parser.ts`, `lib/monthly-report.ts`) — Admin uploads the state's own monthly `.docx` report; `mammoth` extracts text, and an anchor/heuristic-based parser (not fixed line offsets — the source docx's table layout varies enough between months and between the Medical/Adult-Use tables that a fixed offset silently desynced and dropped a whole region one month) pulls out average price by category and active-license counts by region. Stored on `MonthlyMarketReport`, exposed via `stateMarketTrend()`. This is the state's own published aggregate data, not derived from this platform's own deals — distinct from §16's `priceTrend`, which *is* this platform's own closed-deal history.
- **License registry monthly refresh** (`lib/license-registry-import.ts`) — the same CSV format §12's one-time import used, wrapped as a re-runnable Admin upload so the registry stays current as the state re-publishes it monthly, not just a one-time seed.

**Wanted board — buyer-initiated requests**
- Retailers can post what they need when nothing in the feed matches (`ProductRequest`/`ProductRequestResponse` models, `lib/product-requests.ts`, `/retailer/requests`). Visible to every Grower/Processor/Broker (`/grower/requests`, `/processor/requests`, `/broker/requests`) the same way a listing is visible to retailers, just mirrored — **same blind-marketplace boundary as everywhere else**: the retailer shows only as their `anonHandle` to suppliers, and a supplier shows only as their `anonHandle` back to the retailer, except to Broker/Admin (real identity, decision #2). A supplier's response can optionally link one of their own active listings, so the retailer clicks through into the *existing* negotiation machinery (`getOrCreateThread`/`addOfferRound`) instead of this app inventing a second deal-making state machine — deliberately no back-and-forth loop on the response itself, same "v1 scope cut" posture as `SplitContract`.

**Listing distribution — a confirmed reversal of decision #3**
- `Listing.visibility` (`"all"` | `"exclusive"`) + `exclusiveRetailerIds` (`lib/admin.ts`'s `setListingVisibility`, `/admin/listings`). Default is `"all"`, preserving the original bulletin-board behavior for every existing and new listing unless Admin explicitly restricts one. **This is the reversal §17 flagged and the human then confirmed** — read that section first if touching this code; it's a deliberate carve-out into decision #3, not a bug to "fix" back to always-open. `activeListingsFeed`/`getListingAnonymized` (`lib/listings.ts`) both gate on it. Distribution restriction is **Admin-only** in this build (the human specifically chose "Admin can restrict a listing to chosen retailers" over a seller-controlled variant when asked) — don't extend it to sellers themselves without re-confirming, since that's a materially different, smaller deviation from decision #3 than what was actually approved.

**Experimental photo redaction — explicitly not guaranteed**
- `lib/media-redaction.ts`, wired into `lib/media.ts`'s `saveMediaFile`. Uses Claude's vision input to spot an apparent business logo or visible contact info in an uploaded listing photo, then blacks out the reported region with `sharp`. **The human was told directly, before building this, that a missed detection leaks real identity straight through the blind-marketplace boundary this app's core promise depends on** — and chose to build the automatic-redaction version anyway over a detect-and-warn-only alternative. Treat this as what it is: best-effort, not a guarantee. `ListingMedia.redactionAttempted`/`redactionRegionsFound` surface an "Auto-redacted — review" badge on the seller's own listing photos so they still have a chance to catch a miss themselves. Falls back to a no-op if `ANTHROPIC_API_KEY` isn't set, same posture as `lib/ai-listing.ts`.

**Non-circumvention agreement**
- `AgreementAcceptance` model, `lib/agreements.ts`, gated in `lib/dal.ts`'s `requireRole` for every marketplace-participant role (grower/processor/retailer/broker/transporter/sales_rep — not Admin, who isn't a party to it). A user who hasn't accepted the current version is redirected to `/agreements/non-circumvent` before reaching their portal. **The clause text itself is a draft placeholder, not reviewed by a Michigan cannabis attorney** — same caveat as every other legal-adjacent surface in this app (§2, §9). Bump `NON_CIRCUMVENT_VERSION` to force everyone to re-accept if the real text ever replaces the placeholder.

**Sales Rep commission tracking**
- Extends §13's Sales Rep role: `User.salesRepCommissionRate` is a standing rate Admin sets per rep (`/admin/sales-reps`, `setSalesRepCommissionRate`) — unlike §11's Broker commission, a rep doesn't negotiate this per deal. `SalesRepCommission` is created automatically at product acceptance (`lib/commission.ts`'s `acceptProduct`) for any `Deal` whose listing has `createdBySalesRepId` set, snapshotting the rep's rate at that moment so a later rate change never retroactively touches an already-computed commission — same "computed once" posture as Commission. Reps see their own sales/earnings at `/sales/earnings`; tracked-not-processed, `pending` → `paid` via Admin action, same as every other dollar figure in this app (§8).

**Smaller additions bundled into this batch**
- **Retailer search** (`/retailer` — strain/product name and category, plain substring filter on the already-fetched feed, no new index needed at this data volume).
- **Negotiated offer expiration** (`OfferThread.expiresAt`, optional, retailer's own choice when opening a thread; swept lazily like `expireStaleListings`, no background job).
- **Transporter invoicing / transport fee** (`Shipment.transportFeeAmount/transportFeePayer/transportFeeSplitGrowerPct/transportInvoiceUrl/transportFeeStatus`, `lib/shipments.ts`) — the transporter invoices whichever party is paying for transport, tracked the same "never moves money" way as Commission.
- **POS integration scaffolding** (`lib/pos-integration.ts`) — architecture for pushing an accepted deal to Dutchie/Treez/Flowhub/Cova, but **every adapter is a stub**: this platform has no certified API partnership with any of the four, so a "sync" only ever logs an honest `PosSyncLog` row explaining that nothing actually happened. Do not wire a real adapter without verified partner credentials for that specific vendor.

**Still outstanding from this batch**
- Cross-portal "widget-rich" market-intelligence dashboards using `stateMarketTrend()` — since built, see §19.
- A POS-connection settings UI — since built, see §19.

## 19. Third feature batch — METRC connection scaffolding, market widgets, POS settings, sales rep commissions (added 2026-08-16)

- **Sales Rep commission tracking shipped** (§18 described the model; this batch wired the UI): `/admin/sales-reps` sets each rep's rate and marks payouts paid, `/sales/earnings` is the rep's own view.
- **Admin data uploads shipped**: `/admin/data-uploads` for the CRA Monthly Report `.docx` and License Registry CSV, both described in §18. The 5 real months provided (March–July 2026) are seeded into `MonthlyMarketReport`.
- **`StateMarketWidget`** (`components/state-market-widget.tsx`) — surfaces `stateMarketTrend()` on the retailer feed, every seller dashboard (grower/processor via `SellerDashboard`), broker, admin, and sales rep portals. Deliberately **not** added to the Transporter portal — §4's Transporter section explicitly restricts them to their own assigned shipments, not the listing feed or market data, and this wasn't asked to change that.
- **POS settings UI shipped**: `/grower/settings`, `/processor/settings`, `/broker/settings` now render the already-built `components/seller/pos-settings.tsx`.

**METRC connection scaffolding — flagged again before building, per §2's explicit instruction.** The human asked for two things: every licensee (Grower/Processor/Retailer/Transporter — `LICENSED_ROLES`) able to connect their own METRC API credentials, and an Admin-held "developer" (software vendor) API key. This is exactly the scenario §2 says to flag rather than build past — real METRC credentials are the trigger for the still-open "is Broker a recognized MI license category" question, since connecting them starts operationally treating this platform as part of the compliance chain. Flagged via a clarifying question before writing any code; the human's answer was to proceed with **scaffolding only**.

- `MetrcConnection` (per-licensee: `licenseNumber`, `userApiKey`) and `MetrcVendorConfig` (Admin's singleton platform vendor key) — `lib/metrc-integration.ts`, same "not encrypted at rest yet" deferred-hardening note as `PosConnection.apiKey`.
- Settings UI: `components/metrc-settings.tsx` shared across `/grower/settings`, `/processor/settings`, `/retailer/settings`, `/transporter/settings` (the latter two are new pages — Retailer and Transporter had no settings page before this). Admin manages the vendor key and sees every connected licensee at `/admin/metrc`.
- **No live METRC API call exists anywhere in this codebase.** This module stores credentials only — it does not create, read, or validate a manifest, and does not verify a submitted key actually works. Do not wire a real call here without both real API access (the human said it's coming "tomorrow") and the §2 legal review actually happening — API access alone does not resolve §2.
