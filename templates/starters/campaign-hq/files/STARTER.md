# Campaign HQ: starter notes

Campaign HQ is the hub of a marketing team: campaigns, spend against results per channel, audiences, and a content calendar.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Campaign HQ" in `src/styles/theme.json`. The texts are English, in `src/shared/i18n/messages.ts`.

## Pages

The sidebar has three groups: Overview, Marketing (Campaigns with All campaigns and Calendar, then Audiences), and Account.
The header has a search of the pages (Cmd/Ctrl+K) and a bell with alerts: content that needs approval within 48 hours,
and live campaigns whose flight ends within 3 days (`src/features/marketing/api/alerts.queries.ts`).

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: a period menu (7, 30, 90 days) and a CSV export; four figures; conversions of the last 7 days with the top 3 channels; content readiness of the next 14 days; the campaign portfolio; conversions per day; revenue of paid and owned channels; top campaigns; return on ad spend of 6 months; the period results | `src/features/overview` |
| `/app/campaigns` | Campaigns: one card per campaign (budget used, team, time left), the live ones first, and a CSV export | `src/features/campaigns` |
| `/app/campaigns/$campaignId` | One campaign, in three tabs. Overview: the profile, the budget pace, the channels, the latest activity, spend per day, the content, and the audiences. Content: every item. Activity: every event | `src/features/campaigns` |
| `/app/audiences` | Audiences: a table with a filter field, Type (`?type=`), Client, and Campaigns filters, sortable columns, row checkboxes with "Export selected", a row menu, a CSV export, and a side panel for one segment (`?audience=`) | `src/features/audiences` |
| `/app/calendar` | Calendar: one panel with Today, the arrows, a channel menu (`?channel=`), a view menu (Month, Week, Agenda: `?view=`, `?month=`, `?week=`), a CSV export of the shown days, and a campaign filter (`?campaign=`). On a narrow screen the month and the week show as an agenda | `src/features/calendar` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/marketing` holds the parts that all pages use: the channels with their colors and icons, the statuses,
the money and time formats, the metric math, the series functions, the badges, the delta badge, the period menu,
the alerts query, and the CSV and clipboard helpers. `src/shared/ui/record-table.tsx` is the table of the audience page.

## Sample content

The app has no business table. All rows come from one file: `src/features/marketing/lib/sample-data.ts`.
The file makes the same rows for the whole day. Results stop at yesterday, so no result or event is in the future.
It holds 8 clients, 6 team members, 32 campaigns, 40 audiences (5 per client), 180 days of results per channel,
the content items of 6 weeks back and 6 weeks ahead, and the campaign events. All names are fictional.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `TeamMemberRow` to `team_members`, `CampaignRow` to `campaigns`, `ChannelDayRow` to `channel_days`,
   `AudienceRow` to `audiences` (with one row per day of size), `ContentItemRow` to `content_items`,
   `CampaignEventRow` to `campaign_events`. Keep the channel, status, and format lists as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/campaigns/api/campaigns.queries.ts`: the campaign list (with its team) and one campaign.
   - `src/features/overview/api/overview.queries.ts`: the period figures, the week report, and the monthly spend.
   - `src/features/marketing/api/alerts.queries.ts`: the alerts of the header bell.
   - `src/features/audiences/api/audiences.queries.ts`: the segments with their size history.
   - `src/features/calendar/api/calendar.queries.ts`: the content items.
   The sums must come from SQL read functions. `src/features/marketing/lib/series.ts` and `metrics.ts` show the math.
3. Feed `channel_days` from the ad platforms once a day, for example with a scheduled function.
4. Delete `sample-data.ts` and its export when no `queryFn` reads it.
5. `CURRENCY` in `src/features/marketing/lib/format.ts` is `USD`. Set the currency of the team there.

## What is not built

The app has no form. A campaign, an audience, and a content item cannot be added or changed yet.
Add these when the tables exist: "New campaign" with budget and flight, "Pause" and "Resume" on the campaign page,
"Add item" and "Move to review" in the calendar, and the link of an audience to a campaign.

## Rules of the pages

- The status of a campaign comes from its dates: planned before the start, ended after the end, paused when paused.
- The pace compares the spent share of the budget with the passed share of the flight (`pacingOf`).
  From 1.06 it is "Ahead of pace". Under 0.88 it is "Behind pace".
- A content item is "Published" when its time has passed (`contentStatusOf`).
- Cost per conversion is spend divided by conversions. Return on ad spend is revenue divided by spend.
