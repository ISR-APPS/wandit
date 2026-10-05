---
name: mobile-design
description: The quality bar for every screen of this mobile app - navigation map, the design world, first-impression screens, composition, type, states, touch feedback, motion, images, and copy. Load it before you build a new screen, a new flow, or a redesign.
---

# Mobile design

The app must look like a top app of its category in the store, not like a demo or a form.
Read this skill before you build a screen. Then check the screen against the list at the end.

## 1. Plan the navigation before code

Write the navigation map in your plan first. Then build it.

- 2 to 5 main sections: bottom tabs. Each tab holds its own stack.
- More than 5 main sections: tabs for the 4 most used, and a "More" tab with a list.
- A drawer only for many peer sections that the user rarely changes, for example workspaces.
- A detail screen (one item of a list): a push in the stack of its tab.
- A form that belongs to one tab, for example "Edit profile": a push in that tab.
- A short task from anywhere (create, filter, confirm, sign in): a modal at the root stack.
- A destructive action: a confirm step (a dialog), never one tap.
- One screen has one job and one primary action.

Example map for a habit tracker:

```
(tabs)
  (today)/   index: today's habits          -> push habit/[id]
  stats/     index: streaks and charts
  account/   index: profile, settings link  -> push settings
new-habit    modal: name, days, reminder
sign-in      modal
```

Only the first tab is a group folder: a group adds nothing to the URL, so two group tabs
would both own `/`.

Route files stay thin. Each route renders one screen from `src/features/<feature>/screens/`.

## 2. The look comes from a design world

- Load the `design-worlds-mobile` skill on the first build. It picks the world with the user
  and applies it: the fonts, the colors in light and dark mode, the corners, and the recipes.
- The world wins on every visual choice that it names. This skill wins on quality: navigation,
  states, touch, accessibility, and words.
- Later turns keep the world. A new screen uses the recipes and signatures of the same world.
- Never ship the look of the template: a new app always gets a world.
- Do not use the defaults that make an app look generated: a purple-to-blue gradient that the
  world does not name, the same grey card for every block, an icon in a grey circle, an emoji
  as an icon, a centered form on an empty page, or a screen with only a title and a list.

## 3. First impressions

The first screens decide if the app looks premium. Build them with the world recipes.

- **Welcome**: an app that needs a signed-in user opens on a welcome screen when the user is
  signed out (CLAUDE.md, "When the whole app needs a signed-in user"). It has a hero (a photo
  with a scrim, a gradient, SVG art, or big type), the app name in the `display` role, one line
  of promise, and the sign-up and sign-in actions at the bottom. An app with optional accounts
  opens on its home, and its sign-in modal carries the brand.
- **Sign-in and sign-up**: they carry the brand. Use the world recipe: a hero band or a brand
  row, the `title`, the fields, and the primary button. Never a bare form under a native header.
- **Onboarding**: only when the app needs setup facts before it works (a business name, the
  opening days, a goal). One question per screen, at most 3 screens, a progress mark, and the
  "Next" button pinned at the bottom. Save each answer for real.
- **First-run home**: a new app has no rows. Do not show one centered empty state. Show the
  real structure of the screen: the hero, the stat tiles with real zeros, and a "Get started"
  card with 2 to 4 steps that open the create flows. The empty state art fills only the list
  part of the screen.

## 4. Composition

- Each screen has one hero element: a hero block, a big number, a photo, or a large title.
  Give it the most space and the strongest color. Keep the rest quieter.
- Build a clear hierarchy: `display` or `title`, then sections with a `heading` or a world label,
  then content. A reader finds the primary action in one second.
- Vary the rhythm: a hero, then a grid of tiles, then a list. Do not stack five cards of the
  same shape.
- Use the full width for the hero and for photos. Keep the page padding (`px-5`) for text.
- Use the world signatures where the world says. Do not invent a new decoration.

## 5. Spacing and layout

- Use the 4-point grid: `gap-1` to `gap-8`, `p-4` to `p-6`. The page padding is `px-5`.
- Group related rows in one surface with separators (an inset list), not one card per row.
- Put the primary action where the thumb is: at the bottom of a form, or as a header button.
- A touch target is at least 44 x 44 points: `min-h-11` and `min-w-11`.
- Long content scrolls. A short screen centers its content only when it is an empty or a
  success state.
- Lists use `FlatList` (or `@shopify/flash-list` for more than about 100 rows). Never map a
  long array inside a `ScrollView`.

## 6. Type

Use `AppText` with its roles. The world gives the faces through the `--font-*` tokens.

| Role | Use |
| --- | --- |
| `display` | The one big line of a hero or a welcome screen. |
| `title` | The one title at the top of a screen. |
| `heading` | A section title. |
| `body` | Content text. |
| `caption` | Secondary text: a date, a count, a hint. |

- One `display` or one `title` per screen. Do not skip from `title` to `caption` for a section.
- To change the face, change the role. Two `font-*` classes on one text conflict.
- Numbers that change (a count, a price, a timer) keep their width: `tabular-nums`.
- Keep the font scale of the system. Do not set `allowFontScaling={false}`.

## 7. Every data screen has four states

- Loading: a skeleton with the shape of the final layout (`AppSkeleton`). A spinner only
  inside a button or for a full-screen wait under one second.
- Empty: `EmptyState` with the `art` of the world, one sentence, and the action that fills it.
- Error: what failed in plain words and a "Try again" button that calls `refetch()`.
- Content: the real data. A list has pull to refresh: `refreshing={query.isRefetching}` and
  `onRefresh={() => query.refetch()}` on the `FlatList`.

Never show fake rows, fake numbers, or a "lorem ipsum" text.

## 8. Touch feedback

- Every pressable element shows a pressed state. HeroUI buttons do it. A settings or link row
  uses `AppListGroup.Item`. A data row that the world draws, a pressable card, or a tile uses
  `AppPressable` with the press depth of the world, and `accessibilityRole="button"`.
- Haptics (`tapFeedback` and `successFeedback` from `@/shared/lib/haptics`): a light tap on a
  tab change or a toggle, a success pulse after a save. Never on scroll or on every key press.
- While a mutation runs, its button shows the pending state and refuses a second press.
- After a save, close the modal or show the new value at once. Do not leave the user to guess.
- Forms: `returnKeyType` moves to the next field, the last field submits, and the keyboard
  never covers the focused field (`Screen` handles it).

## 9. Motion

The app moves. Motion shows what changed and gives the app its character.

- The router animates pushes, tabs, and modals. Do not animate the whole screen again.
- Content that appears: Reanimated layout animations (`FadeInDown`, `FadeIn`, `ZoomIn`) with
  the durations of the world. Stagger the first 3 or 4 blocks of a screen with `.delay()`.
- Each key screen (welcome, home) has one signature motion from the world: a photo that
  settles, a ring that fills, a glow that breathes, a number that springs in.
- Lists: `LinearTransition` when rows move. No entry animation on every row of a long list.
- Pressable cards scale down a little (`AppPressable`).
- Reanimated skips layout animations when the system asks for reduced motion. A loop or a
  long animation that you write checks `useReducedMotion()` and stays still when it is true.
- Core content and actions must work with no animation.

## 10. Images

- Use the `generate_image` tool for the hero of the welcome screen, onboarding art, and empty
  state art, when the world asks for photos or illustrations. Follow the prompt model of the
  world. Each image costs credits of the user: at most 3 images in the first build, and at
  most 1 in a later turn unless the user asks for more.
- `path` is `src/assets/<name>.png`. Load the returned path with `require()` and a fixed
  relative string, for example `require("../../../assets/welcome-hero.png")` from
  `src/features/<feature>/screens/`.
- Show images with the React Native `Image`: `className="size-full" resizeMode="cover"`.
- Text on a photo sits on a scrim (`bg-linear-to-t from-background ...`) with 4.5:1 contrast.
- An image never shows text, a logo, or a fact (a price, a product that the user did not give).
- A user photo or logo always wins over a generated image.

## 11. Dark mode, right to left, and the web preview

- Use only the semantic classes, so dark mode works with no extra code.
- With Arabic, check the mirror: logical classes (`ps-`, `me-`, `start-`), and arrows flip.
  Use the Arabic fonts of the world for an app in Arabic.
- The web preview shows a phone frame. It has no hover and no camera. A native-only module
  needs a web message (see "No web version" in CLAUDE.md).

## 12. Words

- Name an action with a verb: "Save habit", not "Submit". Keep the same name through the
  flow: the "Delete" button leads to a "Deleted" message.
- Use the voice of the world. Sentence case, unless the world sets capitals. No exclamation
  marks in buttons.
- An error says what happened and what to do next. It never shows a raw error message.
- An empty state invites the first action: "No habits yet. Add your first habit."
- Write in the language of the app, through `t("key")`.

## 13. Accessibility

- An icon-only button has `accessibilityLabel`.
- A pressable row or card has `accessibilityRole="button"`.
- Text contrast is at least 4.5:1 in light and dark, also on a photo or a gradient.
- Color is never the only signal: add an icon or a word to a status.

## Check before you finish a screen

1. The screen is in the navigation map. A pushed or modal route has a stack anchor and a
   `router.canGoBack()` fallback.
2. The screen uses the world: its fonts, its tokens, and its recipe for this kind of screen.
3. The screen has one hero element and a clear hierarchy. It is not a stack of equal cards.
4. Loading, empty, error, and content states exist. A first-run home shows its structure.
5. Every color is a semantic class, so light and dark mode both work.
6. Every pressable has a pressed state; touch targets are 44 points or more.
7. Content that appears has an entry animation, and a loop checks `useReducedMotion()`.
8. No hardcoded color, no left/right class, no raw `Text`, no icon in a grey circle.
9. The copy is real, short, and in the app language.
