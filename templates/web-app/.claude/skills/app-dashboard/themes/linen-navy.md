# Theme linen-navy
Family: cool. Mood: trusted, formal. Fits: finance, legal, insurance, consulting. Avoid: kids, food, beauty.
Radius 0.375rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@600&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme linen-navy (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@600&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme linen-navy: Libre Franklin + Source Serif 4, Arabic twins IBM Plex Sans Arabic + Noto Naskh Arabic (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Libre Franklin", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Source Serif 4", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"Noto Naskh Arabic", "IBM Plex Sans Arabic", ui-serif, Georgia, serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.006 80);
	--foreground: oklch(0.2 0.02 80);
	--card: oklch(0.995 0.002 80);
	--card-foreground: oklch(0.2 0.02 80);
	--popover: oklch(0.995 0.002 80);
	--popover-foreground: oklch(0.2 0.02 80);
	--primary: oklch(0.36 0.1 258);
	--primary-foreground: oklch(0.985 0.005 258);
	--secondary: oklch(0.95 0.014 80);
	--secondary-foreground: oklch(0.27 0.02 80);
	--muted: oklch(0.955 0.012 80);
	--muted-foreground: oklch(0.5 0.022 80);
	--accent: oklch(0.95 0.012 258);
	--accent-foreground: oklch(0.3 0.05 258);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.014 80);
	--input: oklch(0.88 0.016 80);
	--ring: oklch(0.36 0.1 258);
	--sidebar: oklch(0.975 0.009 80);
	--sidebar-foreground: oklch(0.3 0.02 80);
	--sidebar-primary: oklch(0.36 0.1 258);
	--sidebar-primary-foreground: oklch(0.985 0.005 258);
	--sidebar-accent: oklch(0.935 0.016 80);
	--sidebar-accent-foreground: oklch(0.2 0.02 80);
	--sidebar-border: oklch(0.905 0.014 80);
	--sidebar-ring: oklch(0.36 0.1 258);
	--chart-1: oklch(0.36 0.1 258);
	--chart-2: oklch(0.66 0.11 82);
	--chart-3: oklch(0.6 0.1 235);
	--chart-4: oklch(0.52 0.12 30);
	--chart-5: oklch(0.6 0.06 150);
	--radius: 0.375rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.016 80);
	--foreground: oklch(0.965 0.006 80);
	--card: oklch(0.2 0.016 80);
	--card-foreground: oklch(0.965 0.006 80);
	--popover: oklch(0.215 0.016 80);
	--popover-foreground: oklch(0.965 0.006 80);
	--primary: oklch(0.74 0.11 252);
	--primary-foreground: oklch(0.19 0.02 252);
	--secondary: oklch(0.26 0.016 80);
	--secondary-foreground: oklch(0.94 0.006 80);
	--muted: oklch(0.25 0.016 80);
	--muted-foreground: oklch(0.72 0.016 80);
	--accent: oklch(0.28 0.024 252);
	--accent-foreground: oklch(0.965 0.006 80);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.016 80);
	--input: oklch(0.33 0.016 80);
	--ring: oklch(0.74 0.11 252);
	--sidebar: oklch(0.18 0.016 80);
	--sidebar-foreground: oklch(0.88 0.008 80);
	--sidebar-primary: oklch(0.74 0.11 252);
	--sidebar-primary-foreground: oklch(0.19 0.02 252);
	--sidebar-accent: oklch(0.26 0.018 80);
	--sidebar-accent-foreground: oklch(0.965 0.006 80);
	--sidebar-border: oklch(0.27 0.016 80);
	--sidebar-ring: oklch(0.74 0.11 252);
	--chart-1: oklch(0.74 0.11 252);
	--chart-2: oklch(0.82 0.11 85);
	--chart-3: oklch(0.6 0.12 250);
	--chart-4: oklch(0.7 0.12 30);
	--chart-5: oklch(0.78 0.07 150);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.022 80);
	--sidebar-foreground: oklch(0.86 0.011 80);
	--sidebar-primary: oklch(0.74 0.11 252);
	--sidebar-primary-foreground: oklch(0.19 0.02 252);
	--sidebar-accent: oklch(0.285 0.022 80);
	--sidebar-accent-foreground: oklch(0.975 0.007 80);
	--sidebar-border: oklch(0.3 0.022 80);
	--sidebar-ring: oklch(0.74 0.11 252);
}
```
