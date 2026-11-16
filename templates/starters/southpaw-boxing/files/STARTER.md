# Southpaw Boxing Club

This project started from the starter template "Southpaw Boxing Club".
It is a one-page website for a boxing and Muay Thai gym, in the look of a 1960s fight poster.
The club, its people, its prices, and its contact details are fictional sample content.

## Pages and routes

- `/` is the public home page. The build prerenders it. Its sections have anchor ids:
  `#top` (poster), `#code`, `#card`, `#corner`, `#schedule`, `#rounds`, `#belts`, `#book`.
- `/login` and `/app` are the base sign-in page and the base app area. The home page does not link to them.

## Where the code is

- `src/features/landing/components/landing-page.tsx` puts the sections in order. Each section is one file in that folder.
- `src/features/landing/landing.css` holds the poster effects: grain, halftone, stamps, hard shadows, and all motion.
- `src/features/landing/hooks/` holds the reveal on scroll, the scroll progress bar, and the count-up.
- `src/routes/index.tsx` holds the page title, the description, and the icon link.

## Where the sample content is

- All texts are in `src/shared/i18n/messages.ts`, one group for each section:
  `site`, `hero`, `ticker`, `code`, `card`, `corner`, `bill`, `distance`, `belts`, `book`, `footer`.
- The lists are in `src/features/landing/lib/content.ts`: programs (`BOUTS`), house rules (`CODE_ARTICLES`),
  coaches (`COACH_IDS`), the class schedule (`BILL_DAYS`), memberships (`BELTS`), and the contact links (`CONTACT`).
- To change a text, edit `messages.ts`. To add or remove an item, edit `content.ts` and add its texts to `messages.ts`.
- The page has no photo. The boxer, the coach portraits, the belt plates, and the bell are inline SVG drawings.

## Look

- The theme is the design world "palestre" in dark mode with a crimson primary. `src/styles/theme.json` holds it.
- The page uses only theme tokens. `landing.css` mixes them: `--sp-hot` (bright crimson), `--sp-gold` (from `warning`),
  `--sp-surface` (card stock), `--sp-line` (rules).
- Rules of the look: square corners, hard offset shadows, capital condensed titles, one star as separator,
  gold only for the champion items. Each section opens with a "Round" stamp.
- This page keeps its poster layout. Do not apply the diagonal cuts or the duotone photos of the world to it.

## How to make each part real

- Contact details: replace `book.phone`, `book.email`, `book.address`, and `book.hours` in `messages.ts`,
  and `CONTACT` in `content.ts`, with the real details of the user.
- Booking: the ticket in `booking-ticket.tsx` opens an email link. It saves nothing.
  For a real booking form, add a table (for example `trial_requests`) and follow "Public form contract" in `CLAUDE.md`.
  Put the form in `booking-ticket.tsx`, and keep the program choice (`choice`) as one of its fields.
- Programs and prices: `BOUTS` and the group `card` can move to a table `programs` that the public can read.
- Class schedule: `BILL_DAYS` and the group `bill` can move to a table `class_slots` (day, time, name, program).
- Coaches: `COACH_IDS` and the group `corner` can move to a table `coaches`. A real photo can replace each SVG portrait.
- Memberships: `BELTS` and the group `belts` can move to a table `memberships`. Online payment is not available.
- Member area: `/app` is empty. Build member features there only when the user asks for them.
