# Theme basalt-cyan
Family: cool. Mood: cool, high-tech. Fits: IoT, monitoring, telecom, mobility. Avoid: food, beauty, farming.
Radius 0.5rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme basalt-cyan (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme basalt-cyan: Space Grotesk, Arabic twin Noto Kufi Arabic (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Noto Kufi Arabic", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Noto Kufi Arabic", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.01 235);
	--foreground: oklch(0.2 0.032 235);
	--card: oklch(0.995 0.002 235);
	--card-foreground: oklch(0.2 0.032 235);
	--popover: oklch(0.995 0.002 235);
	--popover-foreground: oklch(0.2 0.032 235);
	--primary: oklch(0.5 0.09 222);
	--primary-foreground: oklch(0.985 0.005 222);
	--secondary: oklch(0.95 0.022 235);
	--secondary-foreground: oklch(0.27 0.032 235);
	--muted: oklch(0.955 0.019 235);
	--muted-foreground: oklch(0.5 0.035 235);
	--accent: oklch(0.95 0.011 222);
	--accent-foreground: oklch(0.3 0.045 222);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.022 235);
	--input: oklch(0.88 0.026 235);
	--ring: oklch(0.5 0.09 222);
	--sidebar: oklch(0.975 0.01 235);
	--sidebar-foreground: oklch(0.3 0.032 235);
	--sidebar-primary: oklch(0.5 0.09 222);
	--sidebar-primary-foreground: oklch(0.985 0.005 222);
	--sidebar-accent: oklch(0.935 0.026 235);
	--sidebar-accent-foreground: oklch(0.2 0.032 235);
	--sidebar-border: oklch(0.905 0.022 235);
	--sidebar-ring: oklch(0.5 0.09 222);
	--chart-1: oklch(0.5 0.09 222);
	--chart-2: oklch(0.5 0.17 295);
	--chart-3: oklch(0.6 0.15 135);
	--chart-4: oklch(0.64 0.14 65);
	--chart-5: oklch(0.58 0.16 10);
	--radius: 0.5rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.026 235);
	--foreground: oklch(0.965 0.01 235);
	--card: oklch(0.2 0.026 235);
	--card-foreground: oklch(0.965 0.01 235);
	--popover: oklch(0.215 0.026 235);
	--popover-foreground: oklch(0.965 0.01 235);
	--primary: oklch(0.8 0.12 212);
	--primary-foreground: oklch(0.19 0.02 212);
	--secondary: oklch(0.26 0.026 235);
	--secondary-foreground: oklch(0.94 0.01 235);
	--muted: oklch(0.25 0.026 235);
	--muted-foreground: oklch(0.72 0.026 235);
	--accent: oklch(0.28 0.026 212);
	--accent-foreground: oklch(0.965 0.01 235);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.026 235);
	--input: oklch(0.33 0.026 235);
	--ring: oklch(0.8 0.12 212);
	--sidebar: oklch(0.18 0.026 235);
	--sidebar-foreground: oklch(0.88 0.013 235);
	--sidebar-primary: oklch(0.8 0.12 212);
	--sidebar-primary-foreground: oklch(0.19 0.02 212);
	--sidebar-accent: oklch(0.26 0.029 235);
	--sidebar-accent-foreground: oklch(0.965 0.01 235);
	--sidebar-border: oklch(0.27 0.026 235);
	--sidebar-ring: oklch(0.8 0.12 212);
	--chart-1: oklch(0.8 0.12 212);
	--chart-2: oklch(0.68 0.15 295);
	--chart-3: oklch(0.82 0.16 135);
	--chart-4: oklch(0.82 0.13 72);
	--chart-5: oklch(0.7 0.15 10);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.035 235);
	--sidebar-foreground: oklch(0.86 0.018 235);
	--sidebar-primary: oklch(0.8 0.12 212);
	--sidebar-primary-foreground: oklch(0.19 0.02 212);
	--sidebar-accent: oklch(0.285 0.035 235);
	--sidebar-accent-foreground: oklch(0.975 0.011 235);
	--sidebar-border: oklch(0.3 0.035 235);
	--sidebar-ring: oklch(0.8 0.12 212);
}
```
