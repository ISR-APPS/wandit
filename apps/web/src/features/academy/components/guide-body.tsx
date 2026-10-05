/**
 * The body of an Academy guide: HTML from the API, styled with descendant selectors.
 * academy-guide-page.tsx renders it below the video. The API sanitizes the HTML before it sends it.
 */
type GuideBodyProps = {
	/** `AcademyGuide.bodyHtml`: HTML that the API sanitized with a sanitize-html allowlist. */
	bodyHtml: string;
};

/** Renders the guide HTML. In dark mode, `pre code` resets its background, because the dark `code` rule is more specific. */
export function GuideBody({ bodyHtml }: GuideBodyProps) {
	return (
		<div
			dir="auto"
			className="text-[15px] text-night/85 leading-7 dark:text-foreground/85 [&>*+*]:mt-5 [&_:is(h1,h2,h3,h4)]:font-bold [&_:is(h1,h2,h3,h4)]:font-grotesk [&_:is(h1,h2,h3,h4)]:text-night dark:[&_:is(h1,h2,h3,h4)]:text-foreground [&_a:hover]:decoration-ember [&_a]:font-medium [&_a]:text-ember-text [&_a]:underline [&_a]:decoration-ember/30 [&_a]:underline-offset-4 [&_blockquote]:border-spark [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-night/60 dark:[&_blockquote]:text-foreground/60 [&_code]:rounded-md [&_code]:bg-night/[0.05] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] dark:[&_code]:bg-white/[0.06] [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h4]:text-base [&_hr]:border-night/10 dark:[&_hr]:border-white/10 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-night/[0.08] dark:[&_img]:border-white/10 [&_li+li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-night/[0.08] [&_pre]:bg-night/[0.05] [&_pre]:p-4 dark:[&_pre]:border-white/10 dark:[&_pre]:bg-white/[0.06] [&_pre_code]:bg-transparent [&_pre_code]:p-0 dark:[&_pre_code]:bg-transparent [&_ul]:list-disc [&_ul]:ps-5"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The API sanitizes this HTML with a strict sanitize-html allowlist.
			dangerouslySetInnerHTML={{ __html: bodyHtml }}
		/>
	);
}
