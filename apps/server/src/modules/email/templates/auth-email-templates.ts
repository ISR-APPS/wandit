// Hand-rolled HTML email templates (no react-email dependency): table
// layout + inline styles only, the intersection every mail client renders.
// Copy is English-only for v1 — the sender has no reliable locale signal for
// a recipient who has never signed in.

export type EmailContent = {
	subject: string;
	html: string;
	text: string;
};

export type ExternalDomainDelegationReminderEmailData = {
	dashboardUrl: string;
	domainName: string;
	nameServers: readonly string[];
};

export type ManualRequestEmailData = {
	adminUrl: string;
	fullName: string;
	interval: "month" | "year";
	phone: string;
	plan: "pro" | "business";
	tierCredits: number;
};

const EMBER = "#d16022";

function shell(bodyHtml: string): string {
	return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f6f5f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f2;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#ffffff;border-radius:16px;padding:40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="font-size:20px;font-weight:700;color:#1a1815;padding-bottom:24px;">Wandit</td></tr>
${bodyHtml}
<tr><td style="font-size:12px;color:#8a857d;padding-top:32px;border-top:1px solid #eeece8;">If you didn't request this email, you can safely ignore it.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function magicLinkEmail(url: string): EmailContent {
	return {
		subject: "Your sign-in link for Wandit",
		html: shell(`
<tr><td style="font-size:15px;color:#3d3a35;line-height:1.6;padding-bottom:24px;">Click the button below to sign in. This link works once and expires in 10 minutes.</td></tr>
<tr><td style="padding-bottom:24px;"><a href="${url}" style="display:inline-block;background-color:${EMBER};color:#fcfbf8;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;">Sign in to Wandit</a></td></tr>
<tr><td style="font-size:13px;color:#8a857d;line-height:1.6;">Button not working? Paste this link into your browser:<br><a href="${url}" style="color:${EMBER};word-break:break-all;">${url}</a></td></tr>`),
		text: `Sign in to Wandit\n\nClick this link to sign in (works once, expires in 10 minutes):\n${url}\n\nIf you didn't request this email, you can safely ignore it.`,
	};
}

export function otpEmail(otp: string): EmailContent {
	return {
		subject: `${otp} is your Wandit sign-in code`,
		html: shell(`
<tr><td style="font-size:15px;color:#3d3a35;line-height:1.6;padding-bottom:24px;">Enter this code to sign in. It expires in 10 minutes.</td></tr>
<tr><td style="padding-bottom:8px;"><span style="display:inline-block;background-color:#f6f5f2;border-radius:12px;padding:16px 24px;font-size:28px;font-weight:700;letter-spacing:8px;color:#1a1815;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${otp}</span></td></tr>`),
		text: `${otp} is your Wandit sign-in code. It expires in 10 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
	};
}

export function invitationEmail(data: {
	inviterName: string;
	organizationName: string;
	inviteUrl: string;
}): EmailContent {
	// Both names are user-controlled and land in the SUBJECT as well as the
	// body: strip newlines/control characters (header-shaped input) and bound
	// the length before either is used anywhere.
	const inviterName = sanitizeHeaderText(data.inviterName);
	const organizationName = sanitizeHeaderText(data.organizationName);
	const { inviteUrl } = data;
	return {
		subject: `${inviterName} invited you to ${organizationName} on Wandit`,
		html: shell(`
<tr><td style="font-size:15px;color:#3d3a35;line-height:1.6;padding-bottom:24px;"><strong>${escapeHtml(inviterName)}</strong> invited you to join the <strong>${escapeHtml(organizationName)}</strong> workspace on Wandit. This invitation expires in 7 days.</td></tr>
<tr><td style="padding-bottom:24px;"><a href="${inviteUrl}" style="display:inline-block;background-color:${EMBER};color:#fcfbf8;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;">View invitation</a></td></tr>
<tr><td style="font-size:13px;color:#8a857d;line-height:1.6;">Button not working? Paste this link into your browser:<br><a href="${inviteUrl}" style="color:${EMBER};word-break:break-all;">${inviteUrl}</a></td></tr>`),
		text: `${inviterName} invited you to join the ${organizationName} workspace on Wandit.\n\nView the invitation (expires in 7 days):\n${inviteUrl}\n\nIf you didn't request this email, you can safely ignore it.`,
	};
}

export function externalDomainDelegationReminderEmail(
	data: ExternalDomainDelegationReminderEmailData,
): EmailContent {
	const domainName = sanitizeHeaderText(data.domainName);
	const { dashboardUrl } = data;
	const nameServers = data.nameServers
		.map((nameServer) => sanitizeHeaderText(nameServer))
		.filter((nameServer) => nameServer.length > 0);
	const htmlNameServers = nameServers
		.map(
			(nameServer) =>
				`<tr><td style="font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:14px;color:#1a1815;background-color:#f6f5f2;border-radius:8px;padding:10px 12px;">${escapeHtml(nameServer)}</td></tr>`,
		)
		.join('<tr><td style="height:8px;"></td></tr>');
	const textNameServers = nameServers
		.map((nameServer) => `- ${nameServer}`)
		.join("\n");

	return {
		subject: `Finish connecting ${domainName} to Wandit`,
		html: shell(`
<tr><td style="font-size:15px;color:#3d3a35;line-height:1.6;padding-bottom:16px;">The domain <strong>${escapeHtml(domainName)}</strong> is connected to Wandit, but its nameservers still point elsewhere.</td></tr>
<tr><td style="font-size:15px;color:#3d3a35;line-height:1.6;padding-bottom:16px;">To finish setup, change the nameservers at your domain registrar to:</td></tr>
<tr><td style="padding-bottom:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${htmlNameServers}</table></td></tr>
<tr><td style="padding-bottom:24px;"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background-color:${EMBER};color:#fcfbf8;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;">Open domain settings</a></td></tr>
<tr><td style="font-size:13px;color:#8a857d;line-height:1.6;padding-bottom:16px;">Button not working? Paste this link into your browser:<br><a href="${escapeHtml(dashboardUrl)}" style="color:${EMBER};word-break:break-all;">${escapeHtml(dashboardUrl)}</a></td></tr>
<tr><td style="font-size:13px;color:#8a857d;line-height:1.6;">If you no longer want this domain connected, you can remove it in settings.</td></tr>`),
		text: `Finish connecting ${domainName} to Wandit\n\nThe domain ${domainName} is connected to Wandit, but its nameservers still point elsewhere.\n\nTo finish setup, change the nameservers at your domain registrar to:\n${textNameServers}\n\nOpen domain settings:\n${dashboardUrl}\n\nIf you no longer want this domain connected, you can remove it in settings.`,
	};
}

export function manualRequestEmail(data: ManualRequestEmailData): EmailContent {
	const fullName = sanitizeHeaderText(data.fullName);
	const phone = sanitizeHeaderText(data.phone);
	const plan = data.plan === "business" ? "Business" : "Pro";
	const interval = data.interval === "year" ? "yearly" : "monthly";
	const planSummary = `${plan} / ${data.tierCredits} credits / ${interval}`;
	const adminUrl = sanitizeHeaderText(data.adminUrl);

	return {
		subject: `New offline subscription request — ${fullName}`,
		html: `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1815;line-height:1.6;">
<h1 style="font-size:20px;">New offline subscription request</h1>
<p><strong>Name:</strong> ${escapeHtml(fullName)}<br>
<strong>Phone:</strong> ${escapeHtml(phone)}<br>
<strong>Plan:</strong> ${escapeHtml(planSummary)}</p>
<p><a href="${escapeHtml(adminUrl)}">Open offline billing in admin</a></p>
</body></html>`,
		text: `New offline subscription request\n\nName: ${fullName}\nPhone: ${phone}\nPlan: ${planSummary}\n\nOpen offline billing in admin:\n${adminUrl}`,
	};
}

// Collapse anything header-shaped (CR/LF and other control characters) and
// bound the length, so user text cannot restructure a subject line.
function sanitizeHeaderText(value: string): string {
	return [...value]
		.map((character) => {
			const code = character.charCodeAt(0);

			return code <= 31 || code === 127 ? " " : character;
		})
		.join("")
		.trim()
		.slice(0, 120);
}

// Inviter/org names are user-controlled — escape them before HTML embedding.
// (Magic-link/OTP inputs are server-generated URLs and digits; no user text.)
function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
