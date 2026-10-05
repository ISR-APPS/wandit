# Theme slate-teal
Family: green. Mood: calm, clinical. Fits: health, labs, energy, services. Avoid: beauty, events.
Radius 0.625rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Readex+Pro:wght@400;500;600;700&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme slate-teal (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Readex+Pro:wght@400;500;600;700&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme slate-teal: Manrope, Arabic twin Readex Pro (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Manrope", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Readex Pro", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.008 235);
	--foreground: oklch(0.2 0.028 235);
	--card: oklch(0.995 0.002 235);
	--card-foreground: oklch(0.2 0.028 235);
	--popover: oklch(0.995 0.002 235);
	--popover-foreground: oklch(0.2 0.028 235);
	--primary: oklch(0.5 0.085 192);
	--primary-foreground: oklch(0.985 0.005 192);
	--secondary: oklch(0.95 0.02 235);
	--secondary-foreground: oklch(0.27 0.028 235);
	--muted: oklch(0.955 0.017 235);
	--muted-foreground: oklch(0.5 0.031 235);
	--accent: oklch(0.95 0.01 192);
	--accent-foreground: oklch(0.3 0.043 192);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.02 235);
	--input: oklch(0.88 0.022 235);
	--ring: oklch(0.5 0.085 192);
	--sidebar: oklch(0.975 0.01 235);
	--sidebar-foreground: oklch(0.3 0.028 235);
	--sidebar-primary: oklch(0.5 0.085 192);
	--sidebar-primary-foreground: oklch(0.985 0.005 192);
	--sidebar-accent: oklch(0.935 0.022 235);
	--sidebar-accent-foreground: oklch(0.2 0.028 235);
	--sidebar-border: oklch(0.905 0.02 235);
	--sidebar-ring: oklch(0.5 0.085 192);
	--chart-1: oklch(0.5 0.085 192);
	--chart-2: oklch(0.64 0.13 70);
	--chart-3: oklch(0.48 0.09 255);
	--chart-4: oklch(0.6 0.14 15);
	--chart-5: oklch(0.62 0.13 135);
	--radius: 0.625rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.022 235);
	--foreground: oklch(0.965 0.008 235);
	--card: oklch(0.2 0.022 235);
	--card-foreground: oklch(0.965 0.008 235);
	--popover: oklch(0.215 0.022 235);
	--popover-foreground: oklch(0.965 0.008 235);
	--primary: oklch(0.74 0.11 188);
	--primary-foreground: oklch(0.19 0.02 188);
	--secondary: oklch(0.26 0.022 235);
	--secondary-foreground: oklch(0.94 0.008 235);
	--muted: oklch(0.25 0.022 235);
	--muted-foreground: oklch(0.72 0.022 235);
	--accent: oklch(0.28 0.024 188);
	--accent-foreground: oklch(0.965 0.008 235);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.022 235);
	--input: oklch(0.33 0.022 235);
	--ring: oklch(0.74 0.11 188);
	--sidebar: oklch(0.18 0.022 235);
	--sidebar-foreground: oklch(0.88 0.011 235);
	--sidebar-primary: oklch(0.74 0.11 188);
	--sidebar-primary-foreground: oklch(0.19 0.02 188);
	--sidebar-accent: oklch(0.26 0.025 235);
	--sidebar-accent-foreground: oklch(0.965 0.008 235);
	--sidebar-border: oklch(0.27 0.022 235);
	--sidebar-ring: oklch(0.74 0.11 188);
	--chart-1: oklch(0.74 0.11 188);
	--chart-2: oklch(0.8 0.13 75);
	--chart-3: oklch(0.7 0.1 255);
	--chart-4: oklch(0.72 0.13 15);
	--chart-5: oklch(0.8 0.14 135);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.031 235);
	--sidebar-foreground: oklch(0.86 0.015 235);
	--sidebar-primary: oklch(0.74 0.11 188);
	--sidebar-primary-foreground: oklch(0.19 0.02 188);
	--sidebar-accent: oklch(0.285 0.031 235);
	--sidebar-accent-foreground: oklch(0.975 0.009 235);
	--sidebar-border: oklch(0.3 0.031 235);
	--sidebar-ring: oklch(0.74 0.11 188);
}
```
