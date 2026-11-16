# Keystone starter

Keystone is the back office of a real estate agency.
The team uses it to follow the homes for sale, answer new leads, and plan viewings.
All pages are behind sign-in. The route `/` sends the visitor to `/app`.

## Pages and routes

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: leads per day, newest listings, leads that need an answer, figures, next viewings | `src/features/overview` |
| `/app/listings` | Listings: summary, status tabs, agent filter, table | `src/features/listings` |
| `/app/listings/$listingId` | Listing detail: price, facts, market activity, enquiries, viewings, people, history | `src/features/listings` |
| `/app/leads` | Leads: open pipeline, sources, table. A row opens the lead panel (`?lead=<id>`) | `src/features/leads` |
| `/app/viewings` | Viewings: week agenda, viewings to confirm, latest feedback, past viewings | `src/features/viewings` |
| `/app/profile` | Profile of the signed-in user (base template) | `src/features/profile` |

The navigation is in `src/features/app-shell/lib/nav-items.ts`.

## Sample content

- The sample rows live in `src/features/agency/lib/`. No table and no migration exist.
- `sample-agents.ts`: the team of six agents.
- `sample-listings.ts`: about 70 homes with their prices, sellers, and dates.
- `sample-lead-plans.ts` and `sample-leads.ts`: about 600 leads over six months.
- `sample-viewings.ts`: the viewings of the leads, with the notes of the agents.
- `sample-people.ts`: the name pools. Every name, address, email, and phone number is fictional.
- `book.ts` joins the rows. The query files call its three read functions.
- Each date is relative to the current day. A seeded generator keeps the rows stable during a day.
- The figures cover the 30 whole days before today. Today is not over, so it does not count.

## Make it real

1. Make the tables `agents`, `listings`, `leads`, and `viewings`, with the fields of the types in the sample modules.
   Add row level security for the team of the agency.
2. Replace the body of each `queryFn` with a Supabase call. Keep the query keys and the return types:
   - `src/features/listings/api/listings.queries.ts`: a select of `listings` with the counts of leads, viewings, leads with a viewing, and offers.
   - `src/features/leads/api/leads.queries.ts`: a select of `leads`, newest first, with the listing joined.
   - `src/features/viewings/api/viewings.queries.ts`: a select of `viewings` with the lead and the listing joined.
   - `src/features/overview/api/overview.queries.ts`: one SQL read function per query, called with `rpc`.
3. Delete the sample modules and `book.ts` when no file imports them.
4. Forms: the starter has no create or edit form. Add one per entity when its table exists.
   Examples: "New listing" on the listings page, "Log an answer" in the lead panel, "Book a viewing" on the agenda.
5. The currency is `AGENCY_CURRENCY` in `sample-listings.ts`. The answer target of a lead is `ANSWER_TARGET_HOURS` in `sample-leads.ts`.
   Move both to a settings table.

## Look

- The theme is the look "riad" in light mode, with a floating tinted sidebar.
- `src/styles/theme.json` holds it. Change it with the theme tool, not by hand.
