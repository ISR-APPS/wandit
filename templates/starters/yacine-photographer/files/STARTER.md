# Yacine R.

This project started from the starter template "Yacine R.".
It is a one-page portfolio website for a 35 mm film photographer in Algiers.
The photographer, the clients, the prices, and the contact details are fictional sample content.

## Pages and routes

- `/` is the public home page. The build prerenders it. Its sections have anchor ids:
  `#top` (hero and film strip), `#series`, `#gallery`, `#sheet`, `#about`, `#prints`, `#contact`.
- `/login` and `/app` are the base sign-in page and the base app area. The home page does not link to them.

## Where the code is

- `src/features/landing/components/landing-page.tsx` puts the sections in order. Each section is one file in that folder.
- `photo-frame.tsx` draws every photograph: the image, its frame number, and its EXIF chip.
- `src/features/landing/landing.css` holds the film furniture and the motion: sprocket bands, the photo grade,
  the EXIF chip, the cut entrances, and the drift of the wall.
- `src/features/landing/hooks/` holds the entrance on scroll, the header hairline, and the scroll progress of the wall.
- `src/features/landing/lib/styles.ts` holds the class strings that the sections share.
- `src/routes/index.tsx` holds the page title, the description, and the icon link.

## Where the sample content is

- All texts are in `src/shared/i18n/messages.ts`, one group for each section:
  `site`, `photos`, `hero`, `strip`, `series`, `gallery`, `sheet`, `about`, `testimonial`, `prints`, `contact`, `footer`.
- The eight photographs are in `public/images/`. `src/features/landing/lib/photos.ts` lists them
  with their sizes, their alt keys, and their camera settings.
- The lists are in `src/features/landing/lib/content.ts`: the nav links, the strip frames, the series,
  the wall columns, the contact sheet rows, and the prints.
- To change a text, edit `messages.ts`. To change a photograph, replace its file and its row in `photos.ts`.
- The page states one number three times: three grease marks, "3 of 36" in the roll notes, "I print three" in the note.
  Keep the three equal when you change the contact sheet.

## Look

- The theme is the design world "photographe" in dark mode. `src/styles/theme.json` holds it.
- The page uses only theme tokens: `background` is the ground, `card` is the panel, `canvas` is the film base,
  `foreground` is the paper white, and `primary` is the one grey. The photographs give all the color.
- The mono labels use the display font of the theme (IBM Plex Mono) through the class `yr-mono`. The titles use Syne.
- Rules of the look: square corners, no shadow, no gradient, no type on a photograph, capitals only in mono.
  Entrances are cuts with no fade. The wall of prints is the only scene that moves with the scroll.

## How to make each part real

- Contact details: replace `site.phone`, `site.phoneHref`, and the `contact` group in `messages.ts` with the real details.
- Booking: `message-slip.tsx` opens an email with four lines ready, or calls the studio. It saves nothing.
  For a real form, add a table (for example `booking_requests`) and follow "Public form contract" in `CLAUDE.md`.
  Put the form in `message-slip.tsx`. Its four lines are the fields: type of shoot, date, phone, message.
- Photographs: `PHOTOS` can move to a table `photos` that the public can read, with the files in storage.
- Series: `SERIES` and the group `series` can move to a table `series` with a cover photograph.
- Prints: `PRINTS` and the print keys of the group `prints` can move to a table `prints` (size, price, edition).
  Online payment is not available: a print order goes through the booking form.
- Client quote: replace the group `testimonial` with a real quote, or remove `TestimonialSection` from the page.
- Admin area: `/app` is empty. Build the management of photographs and requests there only when the user asks.
