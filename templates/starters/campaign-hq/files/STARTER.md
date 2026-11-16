# Campaign HQ: starter notes

Campaign HQ is the hub of a marketing team: campaigns, spend against results per channel, audiences, and a content calendar.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Campaign HQ" in `src/styles/theme.json`. The texts are English, in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: conversions, spend by channel, campaigns by status, conversions per day (7, 30, 90 days), cost and return, activity | `src/features/overview` |
| `/app/campaigns` | Campaigns: a table with status tabs (`?status=`), a channel filter (`?channel=`), a search, and a sort | `src/features/campaigns` |
| `/app/campaigns/$campaignId` | One campaign: results, spend per day, results by channel, content, budget pace, details, timeline | `src/features/campaigns` |
| `/app/audiences` | Audiences: three figures, a table with type tabs, and a side panel for one segment (`?audience=`) | `src/features/audiences` |
| `/app/calendar` | Calendar: a month grid (on a phone, an agenda from today), channel chips, a campaign filter (`?campaign=`), the month counts by status and channel, and "Up next" | `src/features/calendar` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/marketing` holds the parts that all pages use: the channels and their colors, the statuses,
the money and time formats, the metric math, the series functions, the badges, and the stacked bar chart.

## Sample content

The app has no business table. All rows come from one file: `src/features/marketing/lib/sample-data.ts`.
The file makes the same rows for the whole day. Results stop at yesterday, so no result or event is in the future.
It holds 8 clients, 6 team members, 32 campaigns, 18 audiences, 180 days of results per channel,
the content items of 6 weeks back and 6 weeks ahead, and the campaign events. All names are fictional.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `TeamMemberRow` to `team_members`, `CampaignRow` to `campaigns`, `ChannelDayRow` to `channel_days`,
   `AudienceRow` to `audiences` (with one row per day of size), `ContentItemRow` to `content_items`,
   `CampaignEventRow` to `campaign_events`. Keep the channel, status, and format lists as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/campaigns/api/campaigns.queries.ts`: the campaign list, one campaign, the newest events.
   - `src/features/overview/api/overview.queries.ts`: the three figures and the two channel series.
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
