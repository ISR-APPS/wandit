# Theme ivory-plum
Family: berry. Mood: refined. Fits: beauty, fashion, wine, events. Avoid: industry, tech, farming.
Radius 0.75rem. Controls: pill.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Alexandria:wght@400;500;600;700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme ivory-plum (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Alexandria:wght@400;500;600;700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme ivory-plum: Plus Jakarta Sans, Arabic twin Alexandria (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Alexandria", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.006 75);
	--foreground: oklch(0.2 0.02 75);
	--card: oklch(0.995 0.002 75);
	--card-foreground: oklch(0.2 0.02 75);
	--popover: oklch(0.995 0.002 75);
	--popover-foreground: oklch(0.2 0.02 75);
	--primary: oklch(0.44 0.13 338);
	--primary-foreground: oklch(0.985 0.005 338);
	--secondary: oklch(0.95 0.014 75);
	--secondary-foreground: oklch(0.27 0.02 75);
	--muted: oklch(0.955 0.012 75);
	--muted-foreground: oklch(0.5 0.022 75);
	--accent: oklch(0.95 0.016 338);
	--accent-foreground: oklch(0.3 0.065 338);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.014 75);
	--input: oklch(0.88 0.016 75);
	--ring: oklch(0.44 0.13 338);
	--sidebar: oklch(0.975 0.009 75);
	--sidebar-foreground: oklch(0.3 0.02 75);
	--sidebar-primary: oklch(0.44 0.13 338);
	--sidebar-primary-foreground: oklch(0.985 0.005 338);
	--sidebar-accent: oklch(0.935 0.016 75);
	--sidebar-accent-foreground: oklch(0.2 0.02 75);
	--sidebar-border: oklch(0.905 0.014 75);
	--sidebar-ring: oklch(0.44 0.13 338);
	--chart-1: oklch(0.44 0.13 338);
	--chart-2: oklch(0.64 0.12 78);
	--chart-3: oklch(0.58 0.09 330);
	--chart-4: oklch(0.55 0.08 195);
	--chart-5: oklch(0.6 0.13 20);
	--radius: 0.75rem;
	--control-radius: 9999px;
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.016 75);
	--foreground: oklch(0.965 0.006 75);
	--card: oklch(0.2 0.016 75);
	--card-foreground: oklch(0.965 0.006 75);
	--popover: oklch(0.215 0.016 75);
	--popover-foreground: oklch(0.965 0.006 75);
	--primary: oklch(0.72 0.13 340);
	--primary-foreground: oklch(0.19 0.02 340);
	--secondary: oklch(0.26 0.016 75);
	--secondary-foreground: oklch(0.94 0.006 75);
	--muted: oklch(0.25 0.016 75);
	--muted-foreground: oklch(0.72 0.016 75);
	--accent: oklch(0.28 0.029 340);
	--accent-foreground: oklch(0.965 0.006 75);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.016 75);
	--input: oklch(0.33 0.016 75);
	--ring: oklch(0.72 0.13 340);
	--sidebar: oklch(0.18 0.016 75);
	--sidebar-foreground: oklch(0.88 0.008 75);
	--sidebar-primary: oklch(0.72 0.13 340);
	--sidebar-primary-foreground: oklch(0.19 0.02 340);
	--sidebar-accent: oklch(0.26 0.018 75);
	--sidebar-accent-foreground: oklch(0.965 0.006 75);
	--sidebar-border: oklch(0.27 0.016 75);
	--sidebar-ring: oklch(0.72 0.13 340);
	--chart-1: oklch(0.72 0.13 340);
	--chart-2: oklch(0.82 0.12 80);
	--chart-3: oklch(0.8 0.08 330);
	--chart-4: oklch(0.74 0.08 195);
	--chart-5: oklch(0.72 0.13 22);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.022 75);
	--sidebar-foreground: oklch(0.86 0.011 75);
	--sidebar-primary: oklch(0.72 0.13 340);
	--sidebar-primary-foreground: oklch(0.19 0.02 340);
	--sidebar-accent: oklch(0.285 0.022 75);
	--sidebar-accent-foreground: oklch(0.975 0.007 75);
	--sidebar-border: oklch(0.3 0.022 75);
	--sidebar-ring: oklch(0.72 0.13 340);
}
```
