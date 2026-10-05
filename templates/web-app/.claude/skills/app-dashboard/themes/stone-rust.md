# Theme stone-rust
Family: warm. Mood: warm, solid. Fits: industry, construction, workshops, real estate. Avoid: health, beauty, kids.
Radius 0.375rem. Controls: matched.

Apply the sections in this order. Apply sidebar=inverse only when the recipe has sidebar=inverse.
With another sidebar value, delete an old `/* sidebar=inverse */` block from `tokens.css`. If you do not delete it, the sidebar keeps the old colors.
Keep every token name and the derived part of `src/styles/tokens.css`.

## Fonts link
https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&family=Changa:wght@600&display=swap

Replace the Fontshare and Google font links in head().links of src/routes/__root.tsx with this one link.
Remove every font line: the font comment, the `preconnect` entry, and each Fontshare or Google Fonts stylesheet entry.
Keep the `tokensCss` entry first. The result:

```tsx
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Fonts of the theme stone-rust (Google Fonts): the Latin faces and their Arabic twins.
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&family=Changa:wght@600&display=swap",
			},
		],
```

## Font block
In `src/styles/tokens.css`, replace the comment above `@theme`, the `@theme` font block, and the `html:lang(ar)` block with this block.
When an earlier theme added a `font-synthesis-weight` rule, delete that rule.
In the header comment of `tokens.css`, find the font note. It starts with `Font pairing` or `Fonts of the theme`.
Replace the note with this text. Keep the `*/` that closes the comment.
`Fonts of the theme stone-rust: Archivo, Arabic twins Cairo + Changa (Google Fonts), loaded in __root.tsx.`

```css
/* Not inside @theme inline: utilities must emit var(--font-*) so the
   :lang(ar) scope below can swap the Latin stacks for the Arabic twins. */
@theme {
	--font-sans: "Archivo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Archivo", ui-sans-serif, system-ui, sans-serif;
}

html:lang(ar) {
	--font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Changa", "Cairo", ui-sans-serif, system-ui, sans-serif;
}
```

## Light
Replace the `:root` block of the palette part of `src/styles/tokens.css`.

```css
:root {
	--background: oklch(0.982 0.005 60);
	--foreground: oklch(0.2 0.016 60);
	--card: oklch(0.995 0.002 60);
	--card-foreground: oklch(0.2 0.016 60);
	--popover: oklch(0.995 0.002 60);
	--popover-foreground: oklch(0.2 0.016 60);
	--primary: oklch(0.53 0.15 40);
	--primary-foreground: oklch(0.985 0.005 40);
	--secondary: oklch(0.95 0.011 60);
	--secondary-foreground: oklch(0.27 0.016 60);
	--muted: oklch(0.955 0.01 60);
	--muted-foreground: oklch(0.5 0.018 60);
	--accent: oklch(0.95 0.018 40);
	--accent-foreground: oklch(0.3 0.075 40);
	--destructive: oklch(0.52 0.2 27);
	--destructive-foreground: oklch(0.985 0 0);
	--border: oklch(0.905 0.011 60);
	--input: oklch(0.88 0.013 60);
	--ring: oklch(0.53 0.15 40);
	--sidebar: oklch(0.975 0.007 60);
	--sidebar-foreground: oklch(0.3 0.016 60);
	--sidebar-primary: oklch(0.53 0.15 40);
	--sidebar-primary-foreground: oklch(0.985 0.005 40);
	--sidebar-accent: oklch(0.935 0.013 60);
	--sidebar-accent-foreground: oklch(0.2 0.016 60);
	--sidebar-border: oklch(0.905 0.011 60);
	--sidebar-ring: oklch(0.53 0.15 40);
	--chart-1: oklch(0.53 0.15 40);
	--chart-2: oklch(0.48 0.07 245);
	--chart-3: oklch(0.64 0.12 80);
	--chart-4: oklch(0.55 0.09 140);
	--chart-5: oklch(0.45 0.09 330);
	--radius: 0.375rem;
	--control-radius: calc(var(--radius) * 0.8);
}
```

## Dark
Replace the `.dark` block of the palette part. Do this for mode=light too.

```css
.dark {
	--background: oklch(0.16 0.013 60);
	--foreground: oklch(0.965 0.005 60);
	--card: oklch(0.2 0.013 60);
	--card-foreground: oklch(0.965 0.005 60);
	--popover: oklch(0.215 0.013 60);
	--popover-foreground: oklch(0.965 0.005 60);
	--primary: oklch(0.7 0.15 45);
	--primary-foreground: oklch(0.19 0.02 45);
	--secondary: oklch(0.26 0.013 60);
	--secondary-foreground: oklch(0.94 0.005 60);
	--muted: oklch(0.25 0.013 60);
	--muted-foreground: oklch(0.72 0.013 60);
	--accent: oklch(0.28 0.033 45);
	--accent-foreground: oklch(0.965 0.005 60);
	--destructive: oklch(0.7 0.18 24);
	--destructive-foreground: oklch(0.19 0.02 24);
	--border: oklch(0.29 0.013 60);
	--input: oklch(0.33 0.013 60);
	--ring: oklch(0.7 0.15 45);
	--sidebar: oklch(0.18 0.013 60);
	--sidebar-foreground: oklch(0.88 0.006 60);
	--sidebar-primary: oklch(0.7 0.15 45);
	--sidebar-primary-foreground: oklch(0.19 0.02 45);
	--sidebar-accent: oklch(0.26 0.014 60);
	--sidebar-accent-foreground: oklch(0.965 0.005 60);
	--sidebar-border: oklch(0.27 0.013 60);
	--sidebar-ring: oklch(0.7 0.15 45);
	--chart-1: oklch(0.7 0.15 45);
	--chart-2: oklch(0.72 0.08 245);
	--chart-3: oklch(0.8 0.12 82);
	--chart-4: oklch(0.74 0.1 140);
	--chart-5: oklch(0.68 0.1 330);
}
```

## sidebar=inverse
Use this block only for sidebar=inverse. Put it after the `.dark` block. It applies in light mode only.
When `tokens.css` already has a `/* sidebar=inverse */` block, replace that block with this block.
Do not keep two inverse blocks. The later block sets the sidebar colors.

```css
/* sidebar=inverse */
:root:not(.dark) {
	--sidebar: oklch(0.21 0.018 60);
	--sidebar-foreground: oklch(0.86 0.009 60);
	--sidebar-primary: oklch(0.7 0.15 45);
	--sidebar-primary-foreground: oklch(0.19 0.02 45);
	--sidebar-accent: oklch(0.285 0.018 60);
	--sidebar-accent-foreground: oklch(0.975 0.005 60);
	--sidebar-border: oklch(0.3 0.018 60);
	--sidebar-ring: oklch(0.7 0.15 45);
}
```
