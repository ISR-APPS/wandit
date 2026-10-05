# Theme clay-olive
Family: green. Mood: earthy, artisanal. Fits: farms, crafts, cafes, interiors. Avoid: tech, finance, health.
Radius 0.375rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme clay-olive (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme clay-olive: DM Sans + Newsreader, Arabic twins IBM Plex Sans Arabic + Amiri (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Newsreader", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Amiri", "IBM Plex Sans Arabic", ui-serif, Georgia, serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.01 70);
	--foreground: oklch(0.2 0.032 70);
	--card: oklch(0.995 0.002 70);
	--card-foreground: oklch(0.2 0.032 70);
	--popover: oklch(0.995 0.002 70);
	--popover-foreground: oklch(0.2 0.032 70);
	--primary: oklch(0.48 0.1 120);
	--primary-foreground: oklch(0.985 0.005 120);
	--secondary: oklch(0.95 0.022 70);
	--secondary-foreground: oklch(0.27 0.032 70);
	--muted: oklch(0.955 0.019 70);
	--muted-foreground: oklch(0.5 0.035 70);
	--accent: oklch(0.95 0.012 120);
	--accent-foreground: oklch(0.3 0.05 120);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.022 70);
	--input: oklch(0.88 0.026 70);
	--ring: oklch(0.48 0.1 120);
	--sidebar: oklch(0.975 0.01 70);
	--sidebar-foreground: oklch(0.3 0.032 70);
	--sidebar-primary: oklch(0.48 0.1 120);
	--sidebar-primary-foreground: oklch(0.985 0.005 120);
	--sidebar-accent: oklch(0.935 0.026 70);
	--sidebar-accent-foreground: oklch(0.2 0.032 70);
	--sidebar-border: oklch(0.905 0.022 70);
	--sidebar-ring: oklch(0.48 0.1 120);
	--chart-1: oklch(0.48 0.1 120);
	--chart-2: oklch(0.55 0.12 42);
	--chart-3: oklch(0.64 0.1 85);
	--chart-4: oklch(0.52 0.07 200);
	--chart-5: oklch(0.48 0.08 330);
	--radius: 0.375rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.026 70);
	--foreground: oklch(0.965 0.01 70);
	--card: oklch(0.2 0.026 70);
	--card-foreground: oklch(0.965 0.01 70);
	--popover: oklch(0.215 0.026 70);
	--popover-foreground: oklch(0.965 0.01 70);
	--primary: oklch(0.76 0.12 118);
	--primary-foreground: oklch(0.19 0.02 118);
	--secondary: oklch(0.26 0.026 70);
	--secondary-foreground: oklch(0.94 0.01 70);
	--muted: oklch(0.25 0.026 70);
	--muted-foreground: oklch(0.72 0.026 70);
	--accent: oklch(0.28 0.026 118);
	--accent-foreground: oklch(0.965 0.01 70);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.026 70);
	--input: oklch(0.33 0.026 70);
	--ring: oklch(0.76 0.12 118);
	--sidebar: oklch(0.18 0.026 70);
	--sidebar-foreground: oklch(0.88 0.013 70);
	--sidebar-primary: oklch(0.76 0.12 118);
	--sidebar-primary-foreground: oklch(0.19 0.02 118);
	--sidebar-accent: oklch(0.26 0.029 70);
	--sidebar-accent-foreground: oklch(0.965 0.01 70);
	--sidebar-border: oklch(0.27 0.026 70);
	--sidebar-ring: oklch(0.76 0.12 118);
	--chart-1: oklch(0.76 0.12 118);
	--chart-2: oklch(0.72 0.12 45);
	--chart-3: oklch(0.84 0.1 88);
	--chart-4: oklch(0.74 0.07 200);
	--chart-5: oklch(0.7 0.08 330);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.035 70);
	--sidebar-foreground: oklch(0.86 0.018 70);
	--sidebar-primary: oklch(0.76 0.12 118);
	--sidebar-primary-foreground: oklch(0.19 0.02 118);
	--sidebar-accent: oklch(0.285 0.035 70);
	--sidebar-accent-foreground: oklch(0.975 0.011 70);
	--sidebar-border: oklch(0.3 0.035 70);
	--sidebar-ring: oklch(0.76 0.12 118);
}
```
