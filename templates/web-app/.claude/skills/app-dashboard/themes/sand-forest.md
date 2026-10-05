# Theme sand-forest
Family: green. Mood: grounded. Fits: farming, outdoor, garden, wood. Avoid: tech, events.
Radius 0.875rem. Controls: pill.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:wght@600&family=Rubik:wght@400;500;600;700&family=El+Messiri:wght@600&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme sand-forest (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:wght@600&family=Rubik:wght@400;500;600;700&family=El+Messiri:wght@600&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme sand-forest: Figtree + Fraunces, Arabic twins Rubik + El Messiri (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Fraunces", ui-serif, Georgia, serif;
}

html:lang(ar) {
	--font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
	--font-display: "El Messiri", "Rubik", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.008 85);
	--foreground: oklch(0.2 0.028 85);
	--card: oklch(0.995 0.002 85);
	--card-foreground: oklch(0.2 0.028 85);
	--popover: oklch(0.995 0.002 85);
	--popover-foreground: oklch(0.2 0.028 85);
	--primary: oklch(0.45 0.085 152);
	--primary-foreground: oklch(0.985 0.005 152);
	--secondary: oklch(0.95 0.02 85);
	--secondary-foreground: oklch(0.27 0.028 85);
	--muted: oklch(0.955 0.017 85);
	--muted-foreground: oklch(0.5 0.031 85);
	--accent: oklch(0.95 0.01 152);
	--accent-foreground: oklch(0.3 0.043 152);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.02 85);
	--input: oklch(0.88 0.022 85);
	--ring: oklch(0.45 0.085 152);
	--sidebar: oklch(0.975 0.01 85);
	--sidebar-foreground: oklch(0.3 0.028 85);
	--sidebar-primary: oklch(0.45 0.085 152);
	--sidebar-primary-foreground: oklch(0.985 0.005 152);
	--sidebar-accent: oklch(0.935 0.022 85);
	--sidebar-accent-foreground: oklch(0.2 0.028 85);
	--sidebar-border: oklch(0.905 0.02 85);
	--sidebar-ring: oklch(0.45 0.085 152);
	--chart-1: oklch(0.45 0.085 152);
	--chart-2: oklch(0.63 0.12 75);
	--chart-3: oklch(0.6 0.07 150);
	--chart-4: oklch(0.55 0.11 40);
	--chart-5: oklch(0.5 0.04 240);
	--radius: 0.875rem;
	--control-radius: 9999px;
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.022 85);
	--foreground: oklch(0.965 0.008 85);
	--card: oklch(0.2 0.022 85);
	--card-foreground: oklch(0.965 0.008 85);
	--popover: oklch(0.215 0.022 85);
	--popover-foreground: oklch(0.965 0.008 85);
	--primary: oklch(0.72 0.11 152);
	--primary-foreground: oklch(0.19 0.02 152);
	--secondary: oklch(0.26 0.022 85);
	--secondary-foreground: oklch(0.94 0.008 85);
	--muted: oklch(0.25 0.022 85);
	--muted-foreground: oklch(0.72 0.022 85);
	--accent: oklch(0.28 0.024 152);
	--accent-foreground: oklch(0.965 0.008 85);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.022 85);
	--input: oklch(0.33 0.022 85);
	--ring: oklch(0.72 0.11 152);
	--sidebar: oklch(0.18 0.022 85);
	--sidebar-foreground: oklch(0.88 0.011 85);
	--sidebar-primary: oklch(0.72 0.11 152);
	--sidebar-primary-foreground: oklch(0.19 0.02 152);
	--sidebar-accent: oklch(0.26 0.025 85);
	--sidebar-accent-foreground: oklch(0.965 0.008 85);
	--sidebar-border: oklch(0.27 0.022 85);
	--sidebar-ring: oklch(0.72 0.11 152);
	--chart-1: oklch(0.72 0.11 152);
	--chart-2: oklch(0.8 0.12 78);
	--chart-3: oklch(0.82 0.07 150);
	--chart-4: oklch(0.7 0.11 42);
	--chart-5: oklch(0.72 0.05 240);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.031 85);
	--sidebar-foreground: oklch(0.86 0.015 85);
	--sidebar-primary: oklch(0.72 0.11 152);
	--sidebar-primary-foreground: oklch(0.19 0.02 152);
	--sidebar-accent: oklch(0.285 0.031 85);
	--sidebar-accent-foreground: oklch(0.975 0.009 85);
	--sidebar-border: oklch(0.3 0.031 85);
	--sidebar-ring: oklch(0.72 0.11 152);
}
```
