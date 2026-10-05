# Theme graphite-lime
Family: ink. Mood: technical, sharp. Fits: dev tools, monitoring, fitness, energy. Avoid: health, beauty, food, kids.
Radius 0.25rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme graphite-lime (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme graphite-lime: IBM Plex Sans + IBM Plex Sans Condensed, Arabic twin IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"IBM Plex Sans Condensed", "IBM Plex Sans", ui-sans-serif, system-ui,
		sans-serif;
}

html:lang(ar) {
	--font-sans: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.001 270);
	--foreground: oklch(0.2 0.004 270);
	--card: oklch(0.995 0.001 270);
	--card-foreground: oklch(0.2 0.004 270);
	--popover: oklch(0.995 0.001 270);
	--popover-foreground: oklch(0.2 0.004 270);
	--primary: oklch(0.24 0.004 270);
	--primary-foreground: oklch(0.985 0.005 270);
	--secondary: oklch(0.95 0.003 270);
	--secondary-foreground: oklch(0.27 0.004 270);
	--muted: oklch(0.955 0.002 270);
	--muted-foreground: oklch(0.5 0.004 270);
	--accent: oklch(0.95 0.01 270);
	--accent-foreground: oklch(0.3 0.002 270);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.003 270);
	--input: oklch(0.88 0.003 270);
	--ring: oklch(0.24 0.004 270);
	--sidebar: oklch(0.975 0.002 270);
	--sidebar-foreground: oklch(0.3 0.004 270);
	--sidebar-primary: oklch(0.24 0.004 270);
	--sidebar-primary-foreground: oklch(0.985 0.005 270);
	--sidebar-accent: oklch(0.935 0.003 270);
	--sidebar-accent-foreground: oklch(0.2 0.004 270);
	--sidebar-border: oklch(0.905 0.003 270);
	--sidebar-ring: oklch(0.24 0.004 270);
	--chart-1: oklch(0.25 0.004 270);
	--chart-2: oklch(0.6 0.16 132);
	--chart-3: oklch(0.45 0.004 270);
	--chart-4: oklch(0.52 0.12 132);
	--chart-5: oklch(0.6 0.004 270);
	--radius: 0.25rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.003 270);
	--foreground: oklch(0.965 0.001 270);
	--card: oklch(0.2 0.003 270);
	--card-foreground: oklch(0.965 0.001 270);
	--popover: oklch(0.215 0.003 270);
	--popover-foreground: oklch(0.965 0.001 270);
	--primary: oklch(0.89 0.19 125);
	--primary-foreground: oklch(0.19 0.02 125);
	--secondary: oklch(0.26 0.003 270);
	--secondary-foreground: oklch(0.94 0.001 270);
	--muted: oklch(0.25 0.003 270);
	--muted-foreground: oklch(0.72 0.003 270);
	--accent: oklch(0.28 0.042 125);
	--accent-foreground: oklch(0.965 0.001 270);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.003 270);
	--input: oklch(0.33 0.003 270);
	--ring: oklch(0.89 0.19 125);
	--sidebar: oklch(0.18 0.003 270);
	--sidebar-foreground: oklch(0.88 0.002 270);
	--sidebar-primary: oklch(0.89 0.19 125);
	--sidebar-primary-foreground: oklch(0.19 0.02 125);
	--sidebar-accent: oklch(0.26 0.004 270);
	--sidebar-accent-foreground: oklch(0.965 0.001 270);
	--sidebar-border: oklch(0.27 0.003 270);
	--sidebar-ring: oklch(0.89 0.19 125);
	--chart-1: oklch(0.89 0.19 125);
	--chart-2: oklch(0.95 0.003 270);
	--chart-3: oklch(0.7 0.16 128);
	--chart-4: oklch(0.72 0.003 270);
	--chart-5: oklch(0.55 0.12 130);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.01 270);
	--sidebar-foreground: oklch(0.86 0.005 270);
	--sidebar-primary: oklch(0.89 0.19 125);
	--sidebar-primary-foreground: oklch(0.19 0.02 125);
	--sidebar-accent: oklch(0.285 0.01 270);
	--sidebar-accent-foreground: oklch(0.975 0.003 270);
	--sidebar-border: oklch(0.3 0.01 270);
	--sidebar-ring: oklch(0.89 0.19 125);
}
```
