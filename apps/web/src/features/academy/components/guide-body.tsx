type GuideBodyProps = {
	bodyHtml: string;
};

export function GuideBody({ bodyHtml }: GuideBodyProps) {
	return (
		<div
			dir="auto"
			className="text-[15px] text-foreground/90 leading-7 [&>*+*]:mt-5 [&_a:hover]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_blockquote]:border-primary/35 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:rounded-md [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_h1]:font-semibold [&_h1]:text-2xl [&_h1]:tracking-tight [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight [&_h3]:font-semibold [&_h3]:text-lg [&_h4]:font-semibold [&_h4]:text-base [&_hr]:border-border [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border [&_li+li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-secondary [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:ps-5"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The API sanitizes this HTML with a strict sanitize-html allowlist.
			dangerouslySetInnerHTML={{ __html: bodyHtml }}
		/>
	);
}
