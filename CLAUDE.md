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
