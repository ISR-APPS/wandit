# Helpline: the support desk of a software company

This project started from the starter template "Helpline". It is an app: the pages are behind sign-in.
The desk has 6 agents, 40 customer companies, about 940 tickets of 180 days, and 25 help articles. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Queue: Next up, the open tickets by deadline, the desk figures with the solves per day, the tickets per topic with their open and late counts | `src/features/queue` |
| `/app/tickets` | Tickets: status tabs (`?status=`), a priority filter, search, sort, pages | `src/features/tickets` |
| `/app/tickets/$ticketId` | One ticket: the conversation, details, the SLA clocks, the customer | `src/features/tickets` |
| `/app/customers` | Customers: plan tabs (`?plan=`). `?customer=<id>` opens one company in a side panel | `src/features/customers` |
| `/app/articles` | Articles: collection tabs (`?collection=`). `?article=<id>` opens one article | `src/features/articles` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
The home follows the `app-dashboard` skill: home `focus-queue`, KPI form `strip`, chart form `heat`.

## Where the sample content is

`src/features/helpdesk/` stands in for the database. `lib/sample-data.ts` holds the sample tables:

| Row type | Becomes the table |
|---|---|
| `AgentRow` | `agents` (name, role) |
| `CustomerRow` | `customers` (name, city, plan, seats, customer since) |
| `ContactRow` | `contacts` (customer, name, job title, email) |
| `TicketRow` | `tickets` (number, subject, customer, requester, assignee, status, priority, channel, topic, article, times, rating) |
| `MessageRow` | `ticket_messages` (ticket, kind: customer, agent, or note, author, body, sent at) |
| `TicketEventRow` | `ticket_events` (ticket, type, agent, occurred at) |
| `ArticleRow` | `articles` (title, collection, status, steps, author, updated at, views of 30 days, helpful votes) |

- Every date is "today minus N days". A seeded generator gives the same rows all day. No file calls `Math.random()`.
- Today's tickets appear only after their time. Their status follows the clock, so no row is in the future.
- `lib/sample-texts.ts` holds the subjects, the messages, and the article texts.
- `lib/ticket-rules.ts` holds the value lists and the rules: statuses, priorities, SLA targets, plans, `slaDueAt`, `isLate`.
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`. Each `queryFn` calls `getSampleTables` and pure functions.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the lists of `ticket-rules.ts` as `check` constraints. Index `tickets (status, created_at)`.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the result types of each query file (`TicketListItem`, `TicketDetail`, `CustomerListItem`), or map the columns to them.
3. The solves per day (`buildDailySeries` of `lib/series.ts`) and the desk figures: write SQL read functions (`data.md`, section 3).
4. The SLA deadline (`slaDueAt`) can become a generated column or a view. Keep one place for the rule, so all pages agree.
5. The ticket list loads every row. Above about 1,000 tickets, page and search on the server (`tables-paging.md` of the skill).
6. When every query reads the database, delete `sample-data.ts` and `sample-texts.ts`.

## What does not exist yet

- No page writes data. No reply box, no assign, no status change, no new ticket form.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog or a form as `tables.md` of the skill shows.
- Good first writes: a reply box under the conversation, an internal note, assign to me, mark as solved.
- Customers have no portal. A portal needs a role column and RLS policies per role.
- Email intake (a ticket from an email) needs an inbound webhook and an Edge Function.
- The app name is `common.appName` in `messages.ts`.
