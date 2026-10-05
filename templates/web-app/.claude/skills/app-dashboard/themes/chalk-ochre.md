# Theme chalk-ochre
Family: warm. Mood: sunny, practical. Fits: food, delivery, schools, retail. Avoid: finance, health.
Radius 0.75rem. Controls: pill.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Bricolage+Grotesque:wght@600&family=Alexandria:wght@400;500;600;700&family=Reem+Kufi:wght@600&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme chalk-ochre (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Bricolage+Grotesque:wght@600&family=Alexandria:wght@400;500;600;700&family=Reem+Kufi:wght@600&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme chalk-ochre: Onest + Bricolage Grotesque, Arabic twins Alexandria + Reem Kufi (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Onest", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"Bricolage Grotesque", "Onest", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Alexandria", ui-sans-serif, system-ui, sans-serif;
	--font-display:
		"Reem Kufi", "Alexandria", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.004 90);
	--foreground: oklch(0.2 0.012 90);
	--card: oklch(0.995 0.002 90);
	--card-foreground: oklch(0.2 0.012 90);
	--popover: oklch(0.995 0.002 90);
	--popover-foreground: oklch(0.2 0.012 90);
	--primary: oklch(0.64 0.135 70);
	--primary-foreground: oklch(0.21 0.02 70);
	--secondary: oklch(0.95 0.008 90);
	--secondary-foreground: oklch(0.27 0.012 90);
	--muted: oklch(0.955 0.007 90);
	--muted-foreground: oklch(0.5 0.013 90);
	--accent: oklch(0.95 0.016 70);
	--accent-foreground: oklch(0.3 0.068 70);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.008 90);
	--input: oklch(0.88 0.01 90);
	--ring: oklch(0.64 0.135 70);
	--sidebar: oklch(0.975 0.005 90);
	--sidebar-foreground: oklch(0.3 0.012 90);
	--sidebar-primary: oklch(0.64 0.135 70);
	--sidebar-primary-foreground: oklch(0.21 0.02 70);
	--sidebar-accent: oklch(0.935 0.01 90);
	--sidebar-accent-foreground: oklch(0.2 0.012 90);
	--sidebar-border: oklch(0.905 0.008 90);
	--sidebar-ring: oklch(0.64 0.135 70);
	--chart-1: oklch(0.6 0.13 70);
	--chart-2: oklch(0.42 0.04 250);
	--chart-3: oklch(0.55 0.1 160);
	--chart-4: oklch(0.62 0.07 72);
	--chart-5: oklch(0.5 0.12 30);
	--radius: 0.75rem;
	--control-radius: 9999px;
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.01 90);
	--foreground: oklch(0.965 0.004 90);
	--card: oklch(0.2 0.01 90);
	--card-foreground: oklch(0.965 0.004 90);
	--popover: oklch(0.215 0.01 90);
	--popover-foreground: oklch(0.965 0.004 90);
	--primary: oklch(0.8 0.14 78);
	--primary-foreground: oklch(0.19 0.02 78);
	--secondary: oklch(0.26 0.01 90);
	--secondary-foreground: oklch(0.94 0.004 90);
	--muted: oklch(0.25 0.01 90);
	--muted-foreground: oklch(0.72 0.01 90);
	--accent: oklch(0.28 0.031 78);
	--accent-foreground: oklch(0.965 0.004 90);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.01 90);
	--input: oklch(0.33 0.01 90);
	--ring: oklch(0.8 0.14 78);
	--sidebar: oklch(0.18 0.01 90);
	--sidebar-foreground: oklch(0.88 0.005 90);
	--sidebar-primary: oklch(0.8 0.14 78);
	--sidebar-primary-foreground: oklch(0.19 0.02 78);
	--sidebar-accent: oklch(0.26 0.011 90);
	--sidebar-accent-foreground: oklch(0.965 0.004 90);
	--sidebar-border: oklch(0.27 0.01 90);
	--sidebar-ring: oklch(0.8 0.14 78);
	--chart-1: oklch(0.8 0.14 78);
	--chart-2: oklch(0.75 0.04 250);
	--chart-3: oklch(0.76 0.1 160);
	--chart-4: oklch(0.9 0.06 85);
	--chart-5: oklch(0.7 0.12 30);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.013 90);
	--sidebar-foreground: oklch(0.86 0.007 90);
	--sidebar-primary: oklch(0.8 0.14 78);
	--sidebar-primary-foreground: oklch(0.19 0.02 78);
	--sidebar-accent: oklch(0.285 0.013 90);
	--sidebar-accent-foreground: oklch(0.975 0.004 90);
	--sidebar-border: oklch(0.3 0.013 90);
	--sidebar-ring: oklch(0.8 0.14 78);
}
```
