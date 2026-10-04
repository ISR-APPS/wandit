---
name: mobile-design
description: The quality bar for every screen of this mobile app - navigation map, look, spacing, type, states, touch feedback, motion, and copy. Load it before you build a new screen, a new flow, or a redesign.
---

# Mobile design

The app must feel like a real app from the store, not a demo screen.
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

## 2. Pick a look from the subject of the app

- Take the colors, the shapes, and the words from the world of the app: a gym app is not a bank app.
- Write the palette into `src/global.css`, light and dark: background, surface, foreground,
  muted, accent, and the status colors. The accent marks the primary action and the active tab only.
- Change each color with its pair: `accent` with `accent-foreground`, `surface` with
  `surface-foreground`, `default` with `default-foreground`. Each pair keeps 4.5:1 contrast.
- Make one element bold: a colored header card, a large number, or one illustration.
  Keep everything around it calm.
- Do not use the defaults that make an app look generated: a purple gradient, the same grey
  card for every block, an emoji as an icon, a shadow under every element, all-caps labels.
- Use the system font unless the brief names a font. Never mix more than two families.

## 3. Spacing and layout

- Use the 4-point grid: `gap-1` to `gap-8`, `p-4` to `p-6`. The page padding is `px-5`.
- Group related rows in one surface with separators (an inset list), not one card per row.
- Put the primary action where the thumb is: at the bottom of a form, or as a header button.
- A touch target is at least 44 x 44 points: `min-h-11` and `min-w-11`.
- Long content scrolls. A short screen centers its content only when it is an empty or a
  success state.
- Lists use `FlatList` (or `@shopify/flash-list` for more than about 100 rows). Never map a
  long array inside a `ScrollView`.

## 4. Type

Use `AppText` with its variants. The scale:

| Variant | Use |
| --- | --- |
| `title` | The one title at the top of a screen. |
| `heading` | A section title. |
| `body` | Content text. |
| `caption` | Secondary text: a date, a count, a hint. |

- One `title` per screen. Do not skip from `title` to `caption` for a section.
- Numbers that change (a count, a price, a timer) keep their width: `tabular-nums`.
- Keep the font scale of the system. Do not set `allowFontScaling={false}`.

## 5. Every data screen has four states

- Loading: a skeleton with the shape of the final layout (`AppSkeleton`). A spinner only
  inside a button or for a full-screen wait under one second.
- Empty: `EmptyState` with an icon, one sentence, and the action that fills the screen.
- Error: what failed in plain words and a "Try again" button that calls `refetch()`.
- Content: the real data. A list has pull to refresh: `refreshing={query.isRefetching}` and
  `onRefresh={() => query.refetch()}` on the `FlatList`.

Never show fake rows, fake numbers, or a "lorem ipsum" text.

## 6. Touch feedback

- Every pressable element shows a pressed state. HeroUI buttons do it. For a row, use
  `AppListGroup.Item`. For a pressable card, wrap it in `Pressable` with `active:opacity-80`.
- Haptics (`tapFeedback` and `successFeedback` from `@/shared/lib/haptics`): a light tap on a
  tab change or a toggle, a success pulse after a save. Never on scroll or on every key press.
- While a mutation runs, its button shows the pending state and refuses a second press.
- After a save, close the modal or show the new value at once. Do not leave the user to guess.
- Forms: `returnKeyType` moves to the next field, the last field submits, and the keyboard
  never covers the focused field (`Screen` handles it).

## 7. Motion

- The router animates pushes, tabs, and modals. Do not add a second animation on top.
- Animate content that appears after a load or a change with Reanimated layout animations
  (`FadeIn`, `FadeOut`, `LinearTransition`), 150 to 250 ms.
- One orchestrated moment per screen at most. No animation on every list row.
- Check `useReducedMotion()` before a long or a looping animation.

## 8. Dark mode, right to left, and the web preview

- Use only the semantic classes, so dark mode works with no extra code.
- With Arabic, check the mirror: logical classes (`ps-`, `me-`, `start-`), and arrows flip.
- The web preview shows a phone frame. It has no hover and no camera. A native-only module
  needs a web message (see "No web version" in CLAUDE.md).

## 9. Words

- Name an action with a verb: "Save habit", not "Submit". Keep the same name through the
  flow: the "Delete" button leads to a "Deleted" message.
- Sentence case. No exclamation marks in buttons.
- An error says what happened and what to do next. It never shows a raw error message.
- An empty state invites the first action: "No habits yet. Add your first habit."
- Write in the language of the app, through `t("key")`.

## 10. Accessibility

- An icon-only button has `accessibilityLabel`.
- A pressable row has `accessibilityRole="button"`.
- Text contrast is at least 4.5:1 in light and dark.
- Color is never the only signal: add an icon or a word to a status.

## Check before you finish a screen

1. The screen is in the navigation map. A pushed or modal route has a stack anchor and a
   `router.canGoBack()` fallback.
2. Loading, empty, error, and content states exist.
3. Every color is a semantic class, so light and dark mode both work.
4. Every pressable has a pressed state; touch targets are 44 points or more.
5. No hardcoded color, no left/right class, no raw `Text`.
6. The copy is real, short, and in the app language.
