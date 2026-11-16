# Rive Nord Realty

A one-page website for a family estate agency. The page is the daily board of the agency:
references, square metres, and prices in large type. The look is a printed poster:
cream paper, ink capitals, one cobalt ink, and red for "Sold".

## Pages and routes

- `/`: the home page. The build prerenders it.
- `/login` and `/app`: the base sign-in and app area. The public page has no link to them.

## Sections of the home page

All files are in `src/features/landing/`. `components/landing-page.tsx` renders the sections in this order:

1. Header with the section links, the telephone, and a menu panel on a phone (`site-header.tsx`, `site-menu.tsx`).
2. Hero: the title in ruled rows, the count of homes, and the listing ticker (`hero-section.tsx`).
3. 01 The register: district filter, the list of homes, and the window at the side (`register-section.tsx`).
4. 02 The districts: a drawn map with pins and the district sheet (`districts-section.tsx`).
5. 03 The method: the cobalt band with four steps (`method-section.tsx`).
6. 04 The numbers, then the slow word band (`numbers-section.tsx`, `word-band.tsx`).
7. 05 Sell: the agency facts and the listing slip (`sell-section.tsx`, `listing-slip.tsx`).
8. Footer with the brand monument, and the call bar on a phone (`site-footer.tsx`, `call-bar.tsx`).

The site CSS (stamps, crop marks, marquees, the map, the entrances) is in `landing.css`.
The facades and the map are inline SVG drawings. The page uses no photo on purpose.

## Sample content

All homes, streets, districts, figures, the address, the email, and the telephone are fictional.

- Homes: `lib/listings.ts` (numbers) and the `listing` group of `src/shared/i18n/messages.ts` (texts).
- Districts and agency totals: `lib/districts.ts` and the `districts` group of `messages.ts`.
- The numbers band: the constants at the top of `components/numbers-section.tsx`.
- Telephone, email, address, and hours: the `site` and `sell` groups of `messages.ts`.

## Make it real

- Homes: make a `listings` table with the fields of the `Listing` type in `lib/listings.ts`.
  Read it with a query in `src/features/landing/api/listings.queries.ts`, and pass the rows to `RegisterSection`.
  The hero ticker and the window read the same rows.
- Districts: make a `districts` table with the fields of the `District` type. Keep the pin positions in it.
- Listing slip: today the slip opens an email with the two choices. For a real form, follow
  "Public form contract" in `CLAUDE.md`: a table, a server function, and a confirmation state.
  Put the form in `components/listing-slip.tsx` in place of the mail link.
- Facts: replace the telephone, email, address, and hours in `messages.ts` with the real values.
- Photos: a real agency can add a photo per home. Put it next to the facade drawing in `listing-row.tsx`
  and in `shop-window.tsx`.
