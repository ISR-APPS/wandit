---
name: design-worlds-app
description: The 16 app design worlds for workspaces (SaaS, admin, CRM, portals, back offices) - each a complete look with tokens, a font pair, a shell, signatures, screen recipes, motion, and imagery. Load it on the first workspace build, when the user asks for another look, and before a redesign.
---

# App design worlds

An app design world is the complete look of one workspace: the color tokens, the font pair, the
corners, the shell of the dashboard kit, two or three signatures, the recipes of the key screens,
the motion, and the images. One world applies to one workspace. The world makes the app look like
a top product of its category, not generated. The `dashboard` skill still gives the structure
(analytics, operations, workbench), and `frontend-design` gives the quality bar.

A marketing page or a landing page uses a website world (`design-worlds-website`), not this skill.
An app with both gets one website world for the public pages and one app world for the workspace.

## 1. Pick the world

1. Your session instructions give `designWorlds=`: the app world ids in a fixed order for this
   project. Other projects get another order, so two similar apps look different.
2. Read the table in section 4. A world fits when the app is in its "best for" list, or close to
   it, and not in its "avoid for" list.
3. First workspace build, and the brief names no look: offer the first 3 fitting worlds of the
   order in the first `ask_user` call. One `single-choice` question, one option per world:
   `{ id: "<world id>", worldId: "<world id>", label: "<world name>", description: "<6 to 10 words>" }`.
   The chat shows each option as a world card. Put the question with the other first-build
   questions (the app language and the missing facts): at most 4 questions in the call.
4. The user delegates or dismisses the question: take the first fitting world of the order.
   Say the world name in your plan.
5. The user describes a look ("dark", "minimal", "like a bank"): take the fitting world closest
   to it. Never copy a brand or a real product.
6. Later turns keep the world: its id is in the header comment of `src/styles/tokens.css`.
   Change it only when the user asks for another look. Then offer 3 other fitting worlds.

## 2. Mix two worlds

The user can ask for a mix ("Fiche, but dark"). Keep one base world: its tokens, fonts, corners,
shell, and motion. You may take ONE signature from a second world and draw it with the base
tokens. Never mix two palettes or two font pairs. Name the base and the borrowed signature in
your plan.

## 3. Apply the world

Do these steps once, at the start of the first workspace build, before the first screen:

1. Read `worlds/<id>.md` of this skill folder in full.
2. In `src/styles/tokens.css`, replace the values of the `:root` block, the `@theme` font block,
   and the `html:lang(ar)` block with the world values. Keep every token name. Remove the
   `.dark` block when the world gives one static treatment. Write the world id in the header
   comment of the file.
3. In `src/routes/__root.tsx`, replace the font links of `head()` with the Google Fonts link and
   the two preconnect links of the world. Remove the links that you replace.
4. Set the `DashboardShell` props to the variant and the density that the world names. The
   content width is a client choice.
5. Add the parts that the world names to `src/shared/ui/` (a table, tabs, a dropdown menu),
   built on the installed `radix-ui` package or plain HTML, with tokens only.
6. Build the screens with the recipes of the world: sign-in, first-run workspace, the main
   records view, the record detail, settings, empty state art, and the 375 px behavior. Pick
   the client choices that the world lists, and write them in your plan.
7. Before you end the turn, answer the self-check of the world and fix each "no".

A screen never hardcodes a color, a font name, or a shadow. A color that the world adds is a
token in `src/styles/tokens.css`. A workspace shows real data only: a new database shows the real
structure with real zeros and a getting-started device, never invented rows or numbers.

## 4. Worlds

| id | name | energy | scheme | best for | avoid for | look |
| --- | --- | --- | --- | --- | --- | --- |
| bordereau | Bordereau | quiet | light only | invoicing, quotes, accounting, freelancer business, expenses, cash book, agency billing | kids, nightlife, fitness, events, games | A statement slip on paper: a serif greeting, mono amounts in hairline columns, and one money bar that splits overdue from not yet due. |
| brigade | Brigade | loud | light only | restaurant, cafe, bakery, catering, food truck, ghost kitchen | finance, clinic, dev tools, legal, kids | Kitchen paper, burnt-ink bands, and one tomato red: live ticket timers on the pass, a roster on the wall, and capitals that call the service. |
| brume | Brume | quiet | light only | AI assistant, agent console, knowledge base, internal tool, notes, research workspace | restaurant, kids, gym, nightlife, shop admin | Pearl calm with a lavender and peach mist behind one floating composer, a serif greeting, cited answers, and quiet lists. |
| cadran | Cadran | medium | light only | SaaS analytics, product metrics, subscriptions, marketing analytics, AI usage, revenue dashboards | clinic, kids, restaurant, booking desk, CRM pipeline | A precision dial for SaaS metrics: KPI tabs that swap the chart, small multiples, hatched no-data bands, and one violet-blue needle. |
| chevet | Chevet | quiet | light only | clinic, dentist, physiotherapy, therapy practice, patient portal, pharmacy, vet clinic, lab results | nightlife, gym, kids games, marketplace, e-commerce, dev tools | Porcelain and pine for a calm practice: a soft day agenda, lab values on their normal range, and one Next patient card. |
| coffre | Coffre | medium | dark only | personal finance, wealth, budgeting, crypto portfolio, treasury, investor portal, fintech dashboard | kids, food, clinic, school, beauty | A bank vault after hours: steel cards, mono uppercase eyebrows, a blue balance line with a glowing end dot, and a spending heatmap. |
| comptoir | Comptoir | medium | light only | e-commerce admin, COD order desk, inventory, shop back office, marketplace seller | clinic, therapy, school, kids, meditation | A grey stockroom canvas, white order slips, and a dark counter slab that holds the search. Cash green means done, amber means waiting. |
| coulisses | Coulisses | loud | dark only | events, ticketing, venues, promoters, festivals, club nights, concerts, theater, conferences | clinic, finance, school, kids, logistics, B2B records | Backstage in violet-black: every event is a ticket stub with torn notches, tiers fill with a magenta-to-tangerine glow, and the door count pulses live. |
| creneau | Créneau | medium | light only | salon, barber, spa, studio classes, gym classes, tutoring, rentals, clinic front desk, coaching | finance, dev tools, e-commerce, CRM pipelines, analytics | A warm white appointment book on a dark aubergine rail: staff columns, hatched closed hours, a moving now line, and stacked date blocks. |
| effectif | Effectif | medium | light only | HR, staff directory, payroll, recruiting, time off, employee portal, team admin | nightlife, kids, crypto, dev tools, restaurant | A deep green frame, a lilac band of morning light, and a people directory you scan by letter: HR that feels kind and in control. |
| etabli | Établi | quiet | dark only | project management, task tracker, issue tracker, agency ops, content calendar, sprint planning | clinic, beauty, kids, restaurant, school | A graphite workbench under one tangerine lamp: grouped rows with status circles, mono IDs, a command palette, and a key for every action. |
| fiche | Fiche | quiet | light only | CRM, sales pipeline, contacts, agency clients, recruiting pipeline, partner lists | kids, nightlife, meditation, restaurants, events | A white card file with typed column icons, pastel tags, filter tokens, and a timeline that shows each change as old value to new value. |
| preau | Préau | loud | light only | school portal, tutoring center, language school, academy, online courses, parent portal, training center | clinic, finance, legal, nightlife, logistics, dev tools | Sky paper, cobalt ink, and a sunflower sticker on today: mastery bars, progress-ring avatars, and a subject-color timetable. |
| regie | Régie | medium | dark only | logistics, dispatch, delivery ops, courier, field service, fleet, warehouse, moving company | beauty, wellness, kids, school, clinic, events | A night dispatch floor in slate, where safety orange lights only the jobs that need a person and every ETA reads like a departure board. |
| sonde | Sonde | quiet | dark only | developer platform, API dashboard, AI agent ops, observability, internal infra, job queues, webhooks, status admin | beauty, kids, food, education, clinic, retail | A graphite console for dev and AI ops: status-dot rows with mono hashes, a live status bar with a UTC clock, and one green signal. |
| tampon | Tampon | loud | light only | creator store, digital products, newsletter, membership community, marketplace seller, indie SaaS | clinic, legal, luxury, finance, kids | Cream paper, black 1 px boxes, and one hot pink stamp. Buttons lift on hover and stamp down, for creators who sell. |
