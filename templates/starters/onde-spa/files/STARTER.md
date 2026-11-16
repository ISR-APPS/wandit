# Onde: starter notes

This project starts from the starter template "Onde".
It is a one-page website for a hammam and spa on the Oran seafront. The look is the design world "Onde".
All names, prices, the address, and the telephone are fictional. Replace them with the real facts.

## Pages and routes

- `/`: the home page. The build prerenders it.
- `/login`, `/app`, and `/app/profile` come from the base template. The home page does not link to them.

## Where the content lives

- Text: `src/shared/i18n/messages.ts`, groups `site` to `footer`. Every string of the page is there.
- Telephone: `site.phoneDisplay`, `site.phoneHref`, `site.phoneAria`, and the booking button `booking.callCta`. The address: `booking.addressLine1` and `booking.addressLine2`.
- Prices and durations: the groups `treatments` and `gifts`. Prices are in dinars (DA), as text.
- Photos: `public/images/*.webp`. `src/features/landing/lib/photos.ts` lists each file with its pixel size.
- Page code: `src/features/landing/`. One file per section in `components/`.
- Page colors, steam, and motion: `src/features/landing/landing.css`. All colors mix the theme tokens.

## Sections, in page order

1. Hero: the steam room photo, the title plate, and the index of the three ritual stages.
2. The ritual (`#ritual`): a photo stage beside a numbered rail of three stages.
3. Treatments (`#treatments`): five price rows beside a sticky column with the linen photo.
4. The water band: the cold pool photo and the one quote of the page.
5. The house (`#house`): four rooms around the tea tray photo.
6. Gift cards (`#gifts`): three cards on a staircase.
7. Booking (`#book`): the questions of the call, the call button, the practical facts, and the stones photo.

## Motion

- Steam veils on the section joins and the pebble glyphs breathe with CSS keyframes.
- `hooks/use-ritual-scrub.ts` changes the ritual photo and the active stage while the section travels up the screen.
  It runs only at 1024 px and wider. On a phone the stage and the rail stack, and the still frame shows.
  The frames come from the pure function in `lib/ritual-timeline.ts`.
- `hooks/use-scroll-reveal.ts` fades each block in when it enters the screen.
- With reduced motion, or with no script, the page shows still and complete: stage 01, every ring drawn.

## How to make each part real

- Real photos: put the files in `public/images/`, then update the sizes in `lib/photos.ts`.
  Keep one soft, warm grade on all photos. `landing.css` adds the same filter to each one.
- A booking form: the page has no form now. Put it in `components/booking-section.tsx`, in place of the list of questions.
  Follow "Public form contract" in `CLAUDE.md`: one table, one RPC, one server function, and the honeypot.
  Use the five questions as the fields, plus the name and the telephone.
- Treatments from the database: make a `treatments` table that anyone may read (name, body, duration, price).
  Read it with a query in `src/features/landing/api/`, and render one `TreatmentRow` per row.
- Gift card orders: a form for the card, the first name, and the delivery, on the same public form contract.
- A second language: follow "Languages" in `CLAUDE.md`. The page uses logical classes, so Arabic works.
