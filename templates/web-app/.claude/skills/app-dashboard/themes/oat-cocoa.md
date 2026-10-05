# Theme oat-cocoa
Family: warm. Mood: warm, cozy. Fits: cafes, bakeries, restaurants, hotels. Avoid: industry, tech, health, finance.
Radius 1rem. Controls: pill.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Young+Serif:wght@400&family=Readex+Pro:wght@400;500;600;700&family=Amiri:wght@700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme oat-cocoa (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Young+Serif:wght@400&family=Readex+Pro:wght@400;500;600;700&family=Amiri:wght@700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme oat-cocoa: Hanken Grotesk + Young Serif, Arabic twins Readex Pro + Amiri (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Young Serif", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "Readex Pro", ui-serif, Georgia, serif;
}

/* Young Serif has one weight, 400. A heavier weight class must not draw a false bold. */
:is(h1, h2, h3, h4, .font-display) {
	font-synthesis-weight: none;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.007 70);
	--foreground: oklch(0.2 0.024 70);
	--card: oklch(0.995 0.002 70);
	--card-foreground: oklch(0.2 0.024 70);
	--popover: oklch(0.995 0.002 70);
	--popover-foreground: oklch(0.2 0.024 70);
	--primary: oklch(0.42 0.06 50);
	--primary-foreground: oklch(0.985 0.005 50);
	--secondary: oklch(0.95 0.017 70);
	--secondary-foreground: oklch(0.27 0.024 70);
	--muted: oklch(0.955 0.014 70);
	--muted-foreground: oklch(0.5 0.026 70);
	--accent: oklch(0.95 0.01 50);
	--accent-foreground: oklch(0.3 0.03 50);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.017 70);
	--input: oklch(0.88 0.019 70);
	--ring: oklch(0.42 0.06 50);
	--sidebar: oklch(0.975 0.01 70);
	--sidebar-foreground: oklch(0.3 0.024 70);
	--sidebar-primary: oklch(0.42 0.06 50);
	--sidebar-primary-foreground: oklch(0.985 0.005 50);
	--sidebar-accent: oklch(0.935 0.019 70);
	--sidebar-accent-foreground: oklch(0.2 0.024 70);
	--sidebar-border: oklch(0.905 0.017 70);
	--sidebar-ring: oklch(0.42 0.06 50);
	--chart-1: oklch(0.42 0.06 50);
	--chart-2: oklch(0.6 0.11 145);
	--chart-3: oklch(0.64 0.11 75);
	--chart-4: oklch(0.52 0.08 240);
	--chart-5: oklch(0.58 0.11 25);
	--radius: 1rem;
	--control-radius: 9999px;
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.019 70);
	--foreground: oklch(0.965 0.007 70);
	--card: oklch(0.2 0.019 70);
	--card-foreground: oklch(0.965 0.007 70);
	--popover: oklch(0.215 0.019 70);
	--popover-foreground: oklch(0.965 0.007 70);
	--primary: oklch(0.74 0.07 55);
	--primary-foreground: oklch(0.19 0.02 55);
	--secondary: oklch(0.26 0.019 70);
	--secondary-foreground: oklch(0.94 0.007 70);
	--muted: oklch(0.25 0.019 70);
	--muted-foreground: oklch(0.72 0.019 70);
	--accent: oklch(0.28 0.015 55);
	--accent-foreground: oklch(0.965 0.007 70);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.019 70);
	--input: oklch(0.33 0.019 70);
	--ring: oklch(0.74 0.07 55);
	--sidebar: oklch(0.18 0.019 70);
	--sidebar-foreground: oklch(0.88 0.01 70);
	--sidebar-primary: oklch(0.74 0.07 55);
	--sidebar-primary-foreground: oklch(0.19 0.02 55);
	--sidebar-accent: oklch(0.26 0.022 70);
	--sidebar-accent-foreground: oklch(0.965 0.007 70);
	--sidebar-border: oklch(0.27 0.019 70);
	--sidebar-ring: oklch(0.74 0.07 55);
	--chart-1: oklch(0.74 0.07 55);
	--chart-2: oklch(0.76 0.11 145);
	--chart-3: oklch(0.82 0.11 78);
	--chart-4: oklch(0.72 0.08 240);
	--chart-5: oklch(0.72 0.11 25);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.026 70);
	--sidebar-foreground: oklch(0.86 0.013 70);
	--sidebar-primary: oklch(0.74 0.07 55);
	--sidebar-primary-foreground: oklch(0.19 0.02 55);
	--sidebar-accent: oklch(0.285 0.026 70);
	--sidebar-accent-foreground: oklch(0.975 0.008 70);
	--sidebar-border: oklch(0.3 0.026 70);
	--sidebar-ring: oklch(0.74 0.07 55);
}
```
