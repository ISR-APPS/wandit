# Theme zinc-cobalt
Family: cool. Mood: exact. Fits: software, B2B, logistics, finance. Avoid: food, beauty, kids.
Radius 0.5rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme zinc-cobalt (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme zinc-cobalt: Geist, Arabic twin IBM Plex Sans Arabic (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Geist", ui-sans-serif, system-ui, sans-serif;
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
	--background: oklch(0.982 0.004 265);
	--foreground: oklch(0.2 0.012 265);
	--card: oklch(0.995 0.002 265);
	--card-foreground: oklch(0.2 0.012 265);
	--popover: oklch(0.995 0.002 265);
	--popover-foreground: oklch(0.2 0.012 265);
	--primary: oklch(0.5 0.19 262);
	--primary-foreground: oklch(0.985 0.005 262);
	--secondary: oklch(0.95 0.008 265);
	--secondary-foreground: oklch(0.27 0.012 265);
	--muted: oklch(0.955 0.007 265);
	--muted-foreground: oklch(0.5 0.013 265);
	--accent: oklch(0.95 0.02 262);
	--accent-foreground: oklch(0.3 0.09 262);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.008 265);
	--input: oklch(0.88 0.01 265);
	--ring: oklch(0.5 0.19 262);
	--sidebar: oklch(0.975 0.005 265);
	--sidebar-foreground: oklch(0.3 0.012 265);
	--sidebar-primary: oklch(0.5 0.19 262);
	--sidebar-primary-foreground: oklch(0.985 0.005 262);
	--sidebar-accent: oklch(0.935 0.01 265);
	--sidebar-accent-foreground: oklch(0.2 0.012 265);
	--sidebar-border: oklch(0.905 0.008 265);
	--sidebar-ring: oklch(0.5 0.19 262);
	--chart-1: oklch(0.5 0.19 262);
	--chart-2: oklch(0.62 0.1 215);
	--chart-3: oklch(0.42 0.13 290);
	--chart-4: oklch(0.6 0.12 165);
	--chart-5: oklch(0.58 0.03 265);
	--radius: 0.5rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.01 265);
	--foreground: oklch(0.965 0.004 265);
	--card: oklch(0.2 0.01 265);
	--card-foreground: oklch(0.965 0.004 265);
	--popover: oklch(0.215 0.01 265);
	--popover-foreground: oklch(0.965 0.004 265);
	--primary: oklch(0.68 0.15 260);
	--primary-foreground: oklch(0.19 0.02 260);
	--secondary: oklch(0.26 0.01 265);
	--secondary-foreground: oklch(0.94 0.004 265);
	--muted: oklch(0.25 0.01 265);
	--muted-foreground: oklch(0.72 0.01 265);
	--accent: oklch(0.28 0.033 260);
	--accent-foreground: oklch(0.965 0.004 265);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.01 265);
	--input: oklch(0.33 0.01 265);
	--ring: oklch(0.68 0.15 260);
	--sidebar: oklch(0.18 0.01 265);
	--sidebar-foreground: oklch(0.88 0.005 265);
	--sidebar-primary: oklch(0.68 0.15 260);
	--sidebar-primary-foreground: oklch(0.19 0.02 260);
	--sidebar-accent: oklch(0.26 0.011 265);
	--sidebar-accent-foreground: oklch(0.965 0.004 265);
	--sidebar-border: oklch(0.27 0.01 265);
	--sidebar-ring: oklch(0.68 0.15 260);
	--chart-1: oklch(0.68 0.15 260);
	--chart-2: oklch(0.78 0.11 215);
	--chart-3: oklch(0.62 0.15 292);
	--chart-4: oklch(0.76 0.12 165);
	--chart-5: oklch(0.7 0.03 265);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.013 265);
	--sidebar-foreground: oklch(0.86 0.007 265);
	--sidebar-primary: oklch(0.68 0.15 260);
	--sidebar-primary-foreground: oklch(0.19 0.02 260);
	--sidebar-accent: oklch(0.285 0.013 265);
	--sidebar-accent-foreground: oklch(0.975 0.004 265);
	--sidebar-border: oklch(0.3 0.013 265);
	--sidebar-ring: oklch(0.68 0.15 260);
}
```
