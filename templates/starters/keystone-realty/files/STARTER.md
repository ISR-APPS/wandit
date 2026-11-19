# Keystone starter

Keystone is the back office of a real estate agency.
The team uses it to follow the homes for sale, answer new leads, and plan viewings.
All pages are behind sign-in. The route `/` sends the visitor to `/app`.

## Pages and routes

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Dashboard: four KPIs; performance chart, featured home, sale progress, next viewings; new leads, leads by source, listing overview; active listings and a calendar | `src/features/overview` |
| `/app/listings` | Listings: four figures, then a table with filter, status, type, and price filters, columns, selection, and CSV export | `src/features/listings` |
| `/app/listings/$listingId` | Listing detail: tabs Overview (profile, sale progress, features, history, offers, interested leads), Viewings, and Enquiries | `src/features/listings` |
| `/app/leads` | Leads: period select; answer target and three counts; sources, follow-ups, and pipeline; then the table. A row opens the lead panel (`?lead=<id>`), `?status=<status>` filters the table | `src/features/leads` |
| `/app/viewings` | Viewings: a calendar with month, week, and agenda views, and CSV export of the shown range | `src/features/viewings` |
| `/app/profile` | Profile of the signed-in user (base template) | `src/features/profile` |

The navigation is in `src/features/app-shell/lib/nav-items.ts`, in three groups: Overview, Agency, and Account.
The bell of the header lists the late leads and the viewings to confirm (`src/features/agency/api/alerts.queries.ts`).

## Sample content

- The sample rows live in `src/features/agency/lib/`. No table and no migration exist.
- `sample-agents.ts`: the team of six agents.
- `sample-listings.ts`: about 70 homes with their prices, sellers, and dates.
- `sample-lead-plans.ts` and `sample-leads.ts`: about 600 leads over six months.
- `sample-viewings.ts`: the viewings of the leads, with the notes of the agents.
- `sample-people.ts`: the name pools. Every name, address, email, and phone number is fictional.
- `book.ts` joins the rows. The query files call its three read functions.
- Each date is relative to the current day. A seeded generator keeps the rows stable during a day.
- The dashboard KPIs compare the state now with the state 30 days ago. The leads page compares a period of 7, 30, or 90 days with the period before it.

## Make it real

1. Make the tables `agents`, `listings`, `leads`, and `viewings`, with the fields of the types in the sample modules.
   Add row level security for the team of the agency.
2. Replace the body of each `queryFn` with a Supabase call. Keep the query keys and the return types:
   - `src/features/listings/api/listings.queries.ts`: a select of `listings` with the counts of leads, viewings, leads with a viewing, and offers.
   - `src/features/leads/api/leads.queries.ts`: a select of `leads`, newest first, with the listing joined.
   - `src/features/viewings/api/viewings.queries.ts`: a select of `viewings` with the lead and the listing joined.
   - `src/features/overview/api/overview.queries.ts`, the figures in `listings.queries.ts`, and the summary in `leads.queries.ts`: one SQL read function per query, called with `rpc`.
   - `src/features/agency/api/alerts.queries.ts`: a select of the late leads and of the viewings to confirm.
3. Delete the sample modules and `book.ts` when no file imports them.
4. Forms: the starter has no create or edit form. Add one per entity when its table exists.
   Examples: "New listing" on the listings page, "Log an answer" in the lead panel, "Book a viewing" on the agenda.
5. The currency is `AGENCY_CURRENCY` in `sample-listings.ts`. The answer target of a lead is `ANSWER_TARGET_HOURS` in `sample-leads.ts`.
   Move both to a settings table.

## Look

- The theme is the look "riad" in light mode: a floating tinted sidebar with colored nav icons, and flat cards.
- `src/styles/theme.json` holds it. Change it with the theme tool, not by hand.
