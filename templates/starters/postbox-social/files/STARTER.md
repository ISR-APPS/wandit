# Postbox: starter notes

Postbox is the social media desk of one brand: reach and engagement, posts, a month schedule, channels, and audience.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Postbox" in `src/styles/theme.json`. The texts are English, in `src/shared/i18n/messages.ts`.

## Navigation

The sidebar has three groups. "Insights" holds Overview and Audience.
"Publishing" holds the parent "Content" (Posts and Schedule) and Channels. "Account" holds Profile.
The list is in `src/features/app-shell/lib/nav-items.ts`. The header has a search (Cmd/Ctrl+K) and the alerts.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: period select (7, 30, 90 days) and CSV export, four stat cards, the engagement report by weekday with likes, comments and shares, the queue donut, post reach, daily impressions, the video and still split, reach by channel, conversation share over six weeks, the period summary | `src/features/overview` |
| `/app/posts` | Posts: status tabs, then a table with a search field, Channel and Format filters, a column menu, row selection, pages, and CSV export | `src/features/posts` |
| `/app/posts/$postId` | One post: the channel card and the facts at the start, the post and older posts of the same channel in the middle, performance and posts of the same pillar at the end | `src/features/posts` |
| `/app/schedule` | Schedule: a month grid of post chips with Today, previous and next month, a Month or List view, and CSV export | `src/features/schedule` |
| `/app/channels` | Channels: a table with a search field, Status and Format filters, a column menu, row selection, and CSV export | `src/features/channels` |
| `/app/channels/$channelId` | One channel: Overview and Posts tabs. Overview shows the profile card, the weekly goal, the formats, the latest activity, the top posts, and the team | `src/features/channels` |
| `/app/audience` | Audience: top cities, new followers, total followers, the inbox, the follower growth as a 7-day mean against the period before, the audience parts table, and the age and city split | `src/features/audience` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/social` holds the parts that all pages use: the channels and their colors, the statuses,
the formats, the time and number formats, the period math, the period select, the charts, the badges,
the CSV export, the clipboard copy, and the header alerts.

## Sample content

The app has no business table. The rows come from `src/features/social/lib/sample-data.ts`
and `src/features/audience/lib/sample-data.ts`. All names, handles, and places are fictional.
The file makes the same rows for the whole day. It plays 180 days of history and 13 days of queue.
A post gets its impressions over four days. Periods end yesterday, so no figure counts a future day.
A post of today is published when its time has passed, else it is scheduled.
A few fixed slots from yesterday to the day after tomorrow keep today and the next days busy.
The pages do not read these files. They read `queryOptions` from the `api/` folder of each feature.

The inbox reply on `/app/audience` goes into the query cache only. It stays until the page reloads,
and no network gets it.

## How to make each part real

1. Create the tables with `apply_migration`: `channels` (from `ChannelProfile`), `posts` (from `Post`),
   `channel_days` (from `DayStat`, one row per channel and day), `audience_parts` (age and city shares),
   and `messages` (from `SampleMessage`). Keep the channel, status, format, and pillar lists as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/overview/api/overview.queries.ts`: all figures of the home for one period.
   - `src/features/posts/api/posts.queries.ts`: the post list, and one post with its channel counts and related posts.
   - `src/features/channels/api/channels.queries.ts`: the channel rows and the detail of one channel.
   - `src/features/audience/api/audience.queries.ts`: the audience parts, the growth of one period, and the inbox.
   - `src/features/social/api/alerts.queries.ts`: the failed posts and the drafts that wait 5 days or more.
   The sums must come from SQL read functions. `src/features/social/lib/series.ts` shows the period math.
3. Feed `posts` and `channel_days` from the network APIs, for example with a scheduled function once an hour.
4. Send the inbox reply with a server function, then refetch the inbox.
5. Delete the sample files when no `queryFn` reads them.

## What is not built

The app has no form to add or change a post, a draft, or a channel.
Add these when the tables exist: "New post" with a time slot, "Retry" on a failed post, and "Connect channel".

## Rules of the pages

- A failed post keeps its reason (`expiredLogin`, `mediaRejected`) until the team fixes it.
- The engagement rate is engagements divided by impressions, over the same days.
- A change compares the period with the period of the same length before it. No previous value gives no change.
- The weekly goal counts the published, scheduled, and failed posts of the current week, Monday first.
- A draft has no time slot, so the schedule does not show it.
