# Postbox: starter notes

Postbox is the social media desk of one brand: reach and engagement, posts, a week schedule, channels, and audience.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Postbox" in `src/styles/theme.json`. The texts are English, in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: impressions per day with a channel filter, four figures with the change (engagements, rate, new followers, posts), engagements by channel, latest posts (7, 30, 90 days) | `src/features/overview` |
| `/app/posts` | Posts: a table with status tabs and a channel filter | `src/features/posts` |
| `/app/posts/$postId` | One post: performance against the channel average, reactions, impressions by day, preview, timeline, related posts | `src/features/posts` |
| `/app/schedule` | Schedule: a week board (an agenda on a phone), weekly goals per channel, drafts | `src/features/schedule` |
| `/app/channels` | Channels: the follower split and one card per account | `src/features/channels` |
| `/app/channels/$channelId` | One channel: figures, impressions per day, top posts, formats, account facts | `src/features/channels` |
| `/app/audience` | Audience: net new followers, growth by channel, age, cities, online hours | `src/features/audience` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/social` holds the parts that all pages use: the channels and their colors, the statuses,
the formats, the time and number formats, the period math, the area chart, and the badges.

## Sample content

The app has no business table. The rows come from `src/features/social/lib/sample-data.ts`
and `src/features/audience/lib/sample-data.ts`. All names, handles, and places are fictional.
The file makes the same rows for the whole day. It plays 180 days of history and 13 days of queue.
A post gets its impressions over four days. Periods end yesterday, so no figure counts a future day.
A post of today is published when its time has passed, else it is scheduled.
A few fixed slots from yesterday to the day after tomorrow keep today and the next days busy.
The pages do not read these files. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`: `channels` (from `ChannelProfile`), `posts` (from `Post`),
   `channel_days` (from `DayStat`, one row per channel and day), and `audience_parts` (age and city shares).
   Keep the channel, status, format, and pillar lists as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/overview/api/overview.queries.ts`: the four figures, the daily impressions, the ranking.
   - `src/features/posts/api/posts.queries.ts`: the post list and one post with its channel average.
   - `src/features/channels/api/channels.queries.ts`: the channel cards and the figures of one channel.
   - `src/features/audience/api/audience.queries.ts`: the follower growth, the growth by channel, and the audience parts.
   The sums must come from SQL read functions. `src/features/social/lib/series.ts` shows the period math.
3. Feed `posts` and `channel_days` from the network APIs, for example with a scheduled function once an hour.
4. Delete the sample files when no `queryFn` reads them.

## What is not built

The app has no form. A post, a draft, and a channel cannot be added or changed yet.
Add these when the tables exist: "New post" with a time slot, "Retry" on a failed post, and "Connect channel".

## Rules of the pages

- A failed post keeps its reason (`expiredLogin`, `mediaRejected`) until the team fixes it.
- The engagement rate is engagements divided by impressions, over the same days.
- A change compares the period with the period of the same length before it. No previous value gives no change.
- The weekly goal counts published and scheduled posts of the shown week.
