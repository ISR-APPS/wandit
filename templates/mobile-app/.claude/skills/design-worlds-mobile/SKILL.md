---
name: design-worlds-mobile
description: The 18 design worlds of this mobile app - each a complete look with a palette, a font pair, corners, signatures, screen recipes, motion, and imagery. Load it on the first build, when the user asks for another look, and before a redesign.
---

# Mobile design worlds

A design world is the complete look of one app: the colors in light and dark mode, the font pair,
the corners, two or three signature elements, the recipes of the key screens, the motion, and the
images. One world applies to one app. The world makes the app look designed and specific, not
generated. The `mobile-design` skill still gives the quality bar: navigation, states, touch,
accessibility, and words.

## 1. Pick the world

1. Your session instructions give "the design world order of this project". It is a fixed order
   for this project only. Other projects get another order, so two similar apps look different.
2. Read the table in section 4. A world fits when the app is in its "best for" list, or close to
   it, and not in its "avoid for" list.
3. First build, and the brief names no look: offer the first 3 fitting worlds of the order in the
   first `ask_user` call. One `single-choice` question, one option per world:
   `{ id: "<world id>", worldId: "<world id>", label: "<world name>", description: "<6 to 10 words>" }`.
   The chat shows each option as a world card. Put the question with the other first-build
   questions (the app language and the missing facts): at most 4 questions in the call.
4. The user delegates or dismisses the question: take the first fitting world of the order.
   Say the world name in your plan.
5. The user describes a look ("dark", "pastel", "like a luxury hotel"): take the fitting world
   closest to it. Never copy a brand or a real app.
6. Later turns keep the world: its id is in the header comment of `src/global.css`. Change
   it only when the user asks for another look. Then offer 3 other fitting worlds, in the
   same way.

## 2. Mix two worlds

The user can ask for a mix ("Vestiaire, but lighter"). Keep one base world: its tokens, fonts,
corners, and motion. You may take ONE signature from a second world and draw it with the base
tokens. Never mix two palettes or two font pairs. Name the base and the borrowed signature in
your plan.

## 3. Apply the world

Do these steps once, at the start of the first build, before the first screen:

1. Read `worlds/<id>.md` of this skill folder in full.
2. Install the fonts of the world with its `npx expo install @expo-google-fonts/...` line.
3. Replace the imports and the keys of `appFonts` in `src/shared/lib/fonts.ts` with the world
   fonts. Then remove the font packages that no file imports: `pnpm remove <package>`.
4. In `src/global.css`, replace the values of the `@theme` block (`--radius`, and
   `--field-border-width` when the world sets it), the `@theme static` font block, and the
   `@variant light` and `@variant dark` blocks with the world values. Add the extra
   `@theme static` color block when the world has one. Write the world id in the header comment.
5. In `app.json`, set the splash `backgroundColor` values and
   `android.adaptiveIcon.backgroundColor` to the world background. A world that is dark only or
   light only also sets `"userInterfaceStyle"`.
6. In `src/shared/ui/app-text.tsx`, add the role that the world names (for example `label`),
   and apply the role changes that the world gives. Each role string keeps one `font-*`
   class and one `text-*` color class.
7. Build the screens with the recipes of the world: welcome, sign-in, onboarding, first-run
   home, lists, detail, empty state art, and tab bar. Pick the client choices that the world
   lists, and write them in your plan.
8. Before you end the turn, answer the self-check of the world and fix each "no".

A screen never hardcodes a color, a font name, or a shadow. A color that the world adds is a
token in `src/global.css`. A color for an SVG fill comes from `useCSSVariable` (from `uniwind`)
or `useThemeColor` (from `heroui-native`).

## 4. Worlds

| id | name | energy | scheme | best for | avoid for | look |
| --- | --- | --- | --- | --- | --- | --- |
| aurore | Aurore | medium | dark only | ai assistant, chatbot, saas, analytics, crypto, dev tools, automation | restaurant, kids, beauty, wellness, heritage | Deep indigo night with drifting teal, violet, and green glows behind glass panels, and a teal caret that blinks where the app waits or writes. |
| boudoir | Boudoir | quiet | both | beauty salon, spa, barber, nail studio, lash and brow, aesthetics, fashion boutique, bridal | gym, kids, finance, logistics, food delivery | Blush plaster, a bronze mirror, and framed portraits: a serif hour for each visit, hairline rules, and labels in spaced capitals. |
| cadence | Cadence | medium | both | habit tracker, running, steps, water tracker, nutrition log, personal health, light fitness, wellbeing goals | gym management, finance, beauty, kids, nightlife | A white page, one electric orange, and a ring that closes every day: big light numbers, week dots, and a streak that lights up. |
| criee | Criée | loud | light only | marketplace, classifieds, resale, swap, community, student app, creators, flea market, local deals | clinic, finance, luxury, meditation, legal | A loud flea-market poster wall: cream paper, thick black edges, hard offset shadows, tilted stickers, and a running ticker band. |
| marelle | Marelle | loud | both | kids activities, family organizer, parents, daycare, babysitting, pets, pet care, birthdays, party planning | finance, clinic, legal, luxury, nightlife, back-office | Candy pastels and plum ink: round sticker avatars with a white edge and a tilt, wavy lines, confetti dots, and entries that bounce. |
| minuit | Minuit | loud | dark only | events, nightlife, clubs, concerts, cinema, tickets, festivals, music, theater | clinic, finance, kids, school, bakery, wellness | A violet-black room lit by one magenta-to-tangerine gradient, with torn ticket stubs, glass that floats, and lowercase poster type that glows. |
| mosaique | Mosaïque | medium | both | to-do, tasks, notes, team tools, planner, projects, study planner, checklists | gym, clinic, nightlife, restaurant, luxury, kids | Four pastel index cards on a pinboard: a bento of tinted tiles, mono capital tags, and a checkbox that snaps shut. |
| potager | Potager | quiet | both | plants, gardening, plant care, eco shop, farm to table, organic grocery, healthy recipes, calm habits | nightlife, finance, gym, dev tools, clinic | Seed-packet cream, sage leaves, and clay pots: soft soil blobs, a hand-drawn sprig, and season chips for apps that grow things. |
| pouls | Pouls | quiet | both | clinic, doctor, dentist, pharmacy, appointments, telehealth, lab results, physiotherapy, vet clinic | nightlife, gym, kids games, fashion, food delivery | A calm clinic at 8:55: white walls, deep teal ink, big light numerals, and one steady heartbeat line across every screen. |
| recre | Récré | loud | light only | education, school, kids learning, language learning, quizzes, tutoring, flashcards, homework | finance, clinic, luxury, nightlife, beauty | A bright sky page of chunky buttons that sink under the thumb, tilted stickers, and a timetable that fills with teacher stamps. |
| registre | Registre | medium | both | crm, stock management, staff rota, point of sale, bookings admin, gym management, shop management, field team admin | meditation, kids, nightlife, food menus, beauty | A clean back office before the doors open: cool paper, blue-black ink, cobalt KPI tiles with live sparklines, and a now line across today's agenda. |
| revue | Revue | medium | both | e-commerce, catalog, fashion retail, furniture, books, concept store, lookbook | kids, fitness, clinic, finance, food delivery, nightlife | A printed catalogue on ivory paper: edge-to-edge photos with captions, serif titles with one italic word, and a terracotta add bar. |
| riad | Riad | medium | both | hotel, guesthouse, riad, travel agency, tours, real estate, holiday rentals, heritage brand, hospitality | gym, kids, finance, clinic, nightlife | Sand plaster by day, indigo by night: every photo framed in an arch, a band of eight-point stars, brass lines, and a calm host's voice. |
| solde | Solde | quiet | both | finance, budget, wallet, expenses, invoices, cash book, accounting, savings | gym, nightlife, kids, food, wellness | A clean paper ledger with amounts typed in mono, a navy card engraved like a banknote, and one mint line that says the account is fine. |
| souffle | Souffle | quiet | both | meditation, sleep, breathing, wellness, therapy, journaling, yoga, mood diary | finance, gym, delivery, marketplace, back office | A dawn sky of lavender and peach, or indigo and plum at night, with one glowing orb that breathes and a soft serif that greets you by the hour. |
| tablee | Tablée | medium | both | restaurant, food delivery, cafe, bakery, catering, recipes, meal planning, food truck | finance, clinic, gym, dev tools, nightlife | Cream linen, tomato red, and saffron: every dish sits on a round color plate, and the menu reads like a bistro card with dotted leaders. |
| trajet | Trajet | medium | both | delivery, courier, logistics, taxi, ride booking, field service, fleet, moving, parcel tracking | beauty, wellness, kids, luxury, education | A night dispatch screen in slate and safety amber: a dashed route line, a live status timeline, and big condensed arrival minutes. |
| vestiaire | Vestiaire | loud | dark only | gym, fitness club, coaching, combat sports, sports club, team app, gym management | clinic, kids, finance, beauty, food | Black steel and one electric volt: giant condensed numbers, black-and-white athletes, and a coach's voice. |
