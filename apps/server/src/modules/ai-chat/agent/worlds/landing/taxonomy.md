# Wandit Taxonomy — categories, niches, labels

Reference for the SaaS gallery + template marketplace. One template = one row = `category` + `niches[]` + `pageType` + style tags.

## The 14 categories (and their niches)

### 1. medical
dentist · aesthetic clinic · general practitioner / cabinet · specialist (cardio, derma, ophtalmo…) · physiotherapy / kiné · pharmacy · medical lab / analyses · optician · veterinary · psychology / therapy · nutritionist · home care / nursing

### 2. beauty
hair salon · barber · spa / hammam · nails & lashes studio · makeup artist · skincare / esthetician · tattoo & piercing · cosmetics brand

### 3. fitness
gym / fitness club · personal trainer / coach · martial arts / combat sports · yoga / pilates studio · crossfit / functional · sports club / academy · dance studio · swimming school

### 4. restaurant
restaurant (classic) · fine dining · café / coffee shop · fast food · pizzeria · street food / food truck · patisserie / bakery · traiteur / catering · gelato / desserts · tea house · food delivery brand

### 5. real-estate
real estate agency · property developer / promoteur · single property showcase · vacation rentals · property management · commercial real estate · interior design / home staging

### 6. construction
general contractor · architect (firm) · renovation / remodeling · plumber · electrician · painting & finishing · aluminum & glass · carpentry / woodwork · landscaping / gardens · HVAC / climatisation

### 7. automotive
car dealer · car rental · garage / mechanic · car wash & detailing · spare parts · motorcycle shop · driving school (can also sit in education)

### 8. services (professional)
lawyer / law firm · accountant · business consultant · insurance agency · translation office · recruitment / HR · marketing services · notary · financial advisor · cleaning company · security company · moving company

### 9. education
private school · language center · training institute / formation · university prep / tutoring · driving school · online courses / e-learning · kindergarten / crèche · coding bootcamp · music school

### 10. creative-agency
marketing / branding agency · design studio · freelancer portfolio · photographer · videographer / production · artist / illustrator · architecture portfolio · music / band · writer / journalist

### 11. ecommerce
COD product landing (single product) · multi-product shop · fashion boutique · electronics / gadgets · cosmetics / skincare brand · home & decor shop · kids & baby shop · grocery / gourmet · jewelry brand · streetwear / drops

### 12. travel
hotel · guesthouse / riad · travel agency · tours & excursions · vacation packages · airline / transport · camping / glamping

### 13. events
wedding services · event planner · venue / salle des fêtes · conference / summit · festival · photographer (events) · DJ / entertainment · rental (chairs, decor, sound)

### 14. tech-saas
SaaS product · mobile app landing · IT services / agency · dev tool · startup (pre-launch / waitlist) · telecom / ISP · AI product · fintech product

## Page types

- `website` — multi-section site (the main focus)
- `landing` — single-page conversion (COD product, app launch, event, waitlist)

## Style axis (tags on every template)

- `mood`: 2-3 free words (cinematic, hushed, playful, editorial, brutal, artisan, heritage, futuristic…)
- `energy`: quiet · medium · loud
- `priceFeel`: accessible · premium
- light or dark base (readable from palette)

Rule: the 5 variants inside a category must span this axis — at least one light + one dark, one quiet + one loud, no repeated display font.

## Launch plan

- **Wave 1 (factory batch, 35 templates):** medical · real-estate · restaurant · fitness · beauty · creative-agency · tech-saas — 5 variants each
- **Wave 1b (optional, SaaS-specific):** ecommerce/COD landing × 5
- **Wave 2:** services · education · construction · automotive · travel · events — 5 each (30 templates)
- Niches are never built separately — a niche is a category template + content swap + tags (a "dentist template" = medical template re-skinned; powers marketplace SEO pages for free)

## Naming convention

`<category>-<nn>` or `<category>-<style-slug>` (e.g. `medical-04`, `realestate-coastal-light`) — folder name = template id everywhere (files, DB, marketplace URL).
