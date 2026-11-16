// The written sample content of the desk: the ticket conversations per topic and the help articles.
// Only sample-data.ts reads this file. It builds tickets, messages, and articles from these texts.
// The texts are fictional. {first} is the first name of the requester, {agent} the first name of the agent.
import type { TicketTopic } from "./ticket-rules";

/** The collections of the help center, in the order of the tabs. Labels: `articles.collections.<collection>`. */
export const ARTICLE_COLLECTIONS = [
	"getting_started",
	"billing",
	"access",
	"integrations",
	"troubleshooting",
] as const;

/** One collection of articles. */
export type ArticleCollection = (typeof ARTICLE_COLLECTIONS)[number];

/** The written part of one help article. */
export type ArticleText = {
	/** Stable id, also the `?article=` value of the articles page. */
	id: string;
	title: string;
	collection: ArticleCollection;
	/** A draft is not public yet. It has no views and no votes. */
	isDraft: boolean;
	/** One sentence under the title. */
	summary: string;
	/** The numbered steps of the article. */
	steps: string[];
};

/** Every help article of the sample help center. */
export const ARTICLE_TEXTS: ArticleText[] = [
	{
		id: "workspace-setup",
		title: "Set up your workspace in five steps",
		collection: "getting_started",
		isDraft: false,
		summary:
			"The first hour in a new workspace, from the company name to the first project.",
		steps: [
			"Open Settings and enter the company name and the time zone.",
			"Upload your logo. It shows on reports and on the client portal.",
			"Create the first project and add two or three tasks.",
			"Invite the people who work on that project.",
			"Turn on the weekly summary email for the owners.",
		],
	},
	{
		id: "invite-team",
		title: "Invite your team and set roles",
		collection: "getting_started",
		isDraft: false,
		summary:
			"Owners, admins, members, and guests: what each role can do and how to invite them.",
		steps: [
			"Open Settings, then People, then Invite.",
			"Enter one email per line. Pick a role for the whole list.",
			"Members see every project. Guests see only the projects you share.",
			"An invite stays valid for 7 days. Resend it from the same list.",
		],
	},
	{
		id: "approval-steps",
		title: "Add approval steps to a workflow",
		collection: "getting_started",
		isDraft: false,
		summary: "Make a record wait for one or two approvers before it moves on.",
		steps: [
			"Open the workflow and select the step that needs an approval.",
			"Add an approver: one person, or anyone with the admin role.",
			"Add a second approver for amounts above a limit, if you need one.",
			"Save. New records follow the new steps at once.",
		],
	},
	{
		id: "guest-access",
		title: "Give guests access to one project",
		collection: "getting_started",
		isDraft: false,
		summary:
			"Share one project with a client or a contractor without showing the rest.",
		steps: [
			"Open the project and select Share.",
			"Enter the email of the guest and keep the role Guest.",
			"Guests do not count as paid seats on the Growth and Scale plans.",
		],
	},
	{
		id: "scheduled-reports",
		title: "Schedule a report by email",
		collection: "getting_started",
		isDraft: false,
		summary:
			"Send a saved report to a list of people every week or every month.",
		steps: [
			"Save the report with the filters that you need.",
			"Select Schedule and pick the day and the hour.",
			"Add the recipients. People outside the workspace get a PDF.",
			"The report uses the time zone of the workspace.",
		],
	},
	{
		id: "failed-payments",
		title: "Why a payment shows twice on your card",
		collection: "billing",
		isDraft: false,
		summary:
			"A failed payment attempt can leave a temporary hold next to the real charge.",
		steps: [
			"Open Billing, then Payments, and find the two attempts.",
			"A declined attempt is not a charge. Your bank releases its hold.",
			"Most banks release a hold within 5 business days.",
			"Give your bank the authorization code of the receipt if the hold stays.",
		],
	},
	{
		id: "tax-details",
		title: "Add a VAT or tax number to invoices",
		collection: "billing",
		isDraft: false,
		summary: "Put your tax number and the legal company name on every invoice.",
		steps: [
			"Open Billing, then Company details.",
			"Enter the legal name, the address, and the tax number.",
			"New invoices show the details. Ask support to reissue an old invoice.",
		],
	},
	{
		id: "change-plan",
		title: "Change your plan or seat count",
		collection: "billing",
		isDraft: false,
		summary: "Upgrades start at once. Downgrades start at the next renewal.",
		steps: [
			"Open Billing, then Plan.",
			"Select the new plan or change the seat count.",
			"An upgrade charges the difference for the rest of the period.",
			"A downgrade keeps the current plan until the renewal date.",
		],
	},
	{
		id: "invoice-contacts",
		title: "Choose who receives invoices",
		collection: "billing",
		isDraft: false,
		summary: "Send invoices to a finance mailbox in place of one person.",
		steps: [
			"Open Billing, then Invoice recipients.",
			"Add a shared address, for example the finance team mailbox.",
			"Remove people who left the company.",
		],
	},
	{
		id: "annual-plans",
		title: "Annual billing and quotes",
		collection: "billing",
		isDraft: true,
		summary: "How annual plans work, and how to get a quote for procurement.",
		steps: [
			"Annual plans get two months free against monthly billing.",
			"Ask support for a quote. It stays valid for 30 days.",
			"Pay by card or by bank transfer against the invoice.",
		],
	},
	{
		id: "two-factor-recovery",
		title: "Recover access when two-factor fails",
		collection: "access",
		isDraft: false,
		summary: "Use a backup code, or ask an admin to reset two-factor for you.",
		steps: [
			"On the sign-in page, select Use a backup code.",
			"No backup code: ask an admin of your workspace to reset two-factor.",
			"Sign in, then set up two-factor again and save the new codes.",
		],
	},
	{
		id: "sso-setup",
		title: "Set up single sign-on with SAML",
		collection: "access",
		isDraft: false,
		summary:
			"Connect your identity provider so people sign in with their work account.",
		steps: [
			"Open Settings, then Security, then Single sign-on.",
			"Copy the callback URL and the entity ID into your identity provider.",
			"Paste the metadata URL of your provider and select Test.",
			"Turn on Enforce only after a test sign-in works.",
		],
	},
	{
		id: "invite-emails",
		title: "Resend or fix an invite email",
		collection: "access",
		isDraft: false,
		summary: "Invites that do not arrive are often in a quarantine folder.",
		steps: [
			"Check the spelling of the address in Settings, then People.",
			"Ask your IT team to allow mail from our sending domain.",
			"Select Resend. Each resend makes a new link.",
		],
	},
	{
		id: "owner-transfer",
		title: "Transfer the account owner role",
		collection: "access",
		isDraft: false,
		summary:
			"The owner can give the role to an admin. Support can help when the owner left.",
		steps: [
			"The current owner opens Settings, then People.",
			"Select the new owner and choose Make owner.",
			"When the owner left the company, send support a request from an admin.",
		],
	},
	{
		id: "sessions",
		title: "How long a session lasts",
		collection: "access",
		isDraft: false,
		summary:
			"Sessions end after 14 days, or earlier when an admin sets a shorter limit.",
		steps: [
			"Open Settings, then Security, then Sessions.",
			"A short idle limit signs people out while they work in another tab.",
			"We suggest 8 hours or more for teams that work all day in the app.",
		],
	},
	{
		id: "calendar-sync",
		title: "Reconnect calendar sync",
		collection: "integrations",
		isDraft: false,
		summary:
			"Sync stops when the calendar token expires or the password changes.",
		steps: [
			"Open Settings, then Integrations, then Calendar.",
			"Select Reconnect and sign in to the calendar account again.",
			"Events of the last 30 days sync again within 10 minutes.",
		],
	},
	{
		id: "webhooks",
		title: "Sign and verify webhook requests",
		collection: "integrations",
		isDraft: false,
		summary:
			"Each webhook request carries a signature header that your server checks.",
		steps: [
			"Copy the signing secret from Settings, then Webhooks.",
			"Compute the HMAC of the raw body with the secret.",
			"Compare it with the signature header. Reject the request when they differ.",
			"A new secret replaces the old one after 24 hours.",
		],
	},
	{
		id: "api-limits",
		title: "API rate limits and retries",
		collection: "integrations",
		isDraft: false,
		summary: "The API allows 600 requests per minute per workspace.",
		steps: [
			"A 429 answer means that you passed the limit.",
			"Wait for the time in the Retry-After header, then try again.",
			"Use the bulk endpoints for imports of more than 1,000 records.",
		],
	},
	{
		id: "accounting-export",
		title: "Export invoices to your accounting tool",
		collection: "integrations",
		isDraft: true,
		summary:
			"The nightly export sends paid and unpaid invoices to your accounting tool.",
		steps: [
			"Open Settings, then Integrations, then Accounting.",
			"Pick the first invoice date to export.",
			"Invoices with a missing tax number stay in the error list.",
		],
	},
	{
		id: "csv-import",
		title: "Import records from a CSV file",
		collection: "integrations",
		isDraft: false,
		summary: "Map each column of the file to a field, then check the preview.",
		steps: [
			"Save the file as UTF-8 CSV with one header row.",
			"Pick the date format of the file before you map the columns.",
			"Check the preview of the first 20 rows, then start the import.",
		],
	},
	{
		id: "empty-charts",
		title: "Charts show no data",
		collection: "troubleshooting",
		isDraft: false,
		summary:
			"Most empty charts come from a date filter or a missing permission.",
		steps: [
			"Check the date range at the top of the dashboard.",
			"Members see only the projects that they belong to.",
			"Clear the cache of the browser if the chart stays empty.",
		],
	},
	{
		id: "pdf-export",
		title: "Fix cut columns in PDF exports",
		collection: "troubleshooting",
		isDraft: false,
		summary: "Wide tables need the landscape layout or fewer columns.",
		steps: [
			"In the export dialog, select Landscape.",
			"Hide the columns that the reader does not need.",
			"Tables with more than 12 columns export better as CSV.",
		],
	},
	{
		id: "offline-sync",
		title: "Resolve duplicates after offline edits",
		collection: "troubleshooting",
		isDraft: true,
		summary:
			"The mobile app can save one edit two times when the network comes back.",
		steps: [
			"Update the mobile app to the latest version.",
			"Open the record and select Merge on the duplicate banner.",
		],
	},
	{
		id: "time-zones",
		title: "Time zones on shared reports",
		collection: "troubleshooting",
		isDraft: false,
		summary:
			"Shared reports use the time zone of the workspace, not of the reader.",
		steps: [
			"Open Settings and check the time zone of the workspace.",
			"Each person can set a personal time zone in the profile.",
			"Scheduled reports always use the workspace time zone.",
		],
	},
	{
		id: "upload-stalls",
		title: "Uploads that stop before the end",
		collection: "troubleshooting",
		isDraft: false,
		summary:
			"Files above 250 MB and some company proxies stop an upload near the end.",
		steps: [
			"Check that the file is under 250 MB.",
			"Try another network, for example without the VPN.",
			"Send us the time of the upload so we can find it in the logs.",
		],
	},
];

/** The written part of one ticket conversation. Every ticket of a topic uses one script of that topic. */
export type TicketScript = {
	/** Three ways to name the same problem. The ticket number picks one, so the list shows fewer twin subjects. */
	subjects: readonly [string, string, string];
	/** The first message of the customer. */
	opening: string;
	/** The first reply of the agent. */
	reply: string;
	/** The second message of the customer, after the reply. */
	followUp: string;
	/** The last reply of the agent, when the ticket is solved. */
	closing: string;
	/** An internal note of the agent. Only the team sees it. */
	note: string;
	/** The id of the help article that the reply links, or null. */
	articleId: string | null;
};

/** Six scripts per topic. The open tickets use each script at most one time, so the queue has no twin subjects. */
export const TICKET_SCRIPTS: Record<TicketTopic, TicketScript[]> = {
	billing: [
		{
			subjects: [
				"Charged twice for this month's invoice",
				"Two charges on our card this month",
				"Double payment for the same invoice",
			],
			opening:
				"Hi, our company card shows two charges of the same amount for this month. Can you check and refund the second one? Thanks, {first}",
			reply:
				"Hi {first}, thanks for the alert. I see two payment attempts: the first one failed at your bank, the second one went through. Only one charge is final. The other line is a hold that your bank releases.",
			followUp:
				"Thanks. The hold is still on the card statement this morning. Is there a reference that I can give our bank?",
			closing:
				"Yes: the authorization code is on the receipt that I attach. Your bank can match it with the hold. I mark this as solved, but reply here if the hold stays after five business days.",
			note: "Payment log: attempt 1 declined by the bank, attempt 2 captured. No refund needed.",
			articleId: "failed-payments",
		},
		{
			subjects: [
				"Need our VAT number on the invoices",
				"Add our tax number to the invoices",
				"Invoices need our legal company name",
			],
			opening:
				"Hello, our finance team needs our VAT number and the legal company name on every invoice. Can you add them and send the last three invoices again?",
			reply:
				"Hi {first}, you can add the tax number under Billing, then Company details. New invoices show it at once. I can reissue the last three invoices after you save it.",
			followUp:
				"Done, the details are saved. Please reissue the invoices of the last three months.",
			closing:
				"The three invoices are reissued with the new details. You find them under Billing, then Invoices. Have a good day, {first}.",
			note: "Reissued 3 invoices from the billing console. Old PDFs are void.",
			articleId: "tax-details",
		},
		{
			subjects: [
				"Downgrade from Scale to Growth at renewal",
				"Do we lose data if we move to Growth?",
				"Plan change at the next renewal",
			],
			opening:
				"We want to move to the Growth plan when our contract renews. Do we lose any data when we downgrade?",
			reply:
				"Hi {first}, you keep all your data. Two features of Scale stop at the renewal: audit export and custom roles. You can plan the change today under Billing, then Plan.",
			followUp:
				"OK. We use custom roles for two contractors. What happens to their access?",
			closing:
				"Their custom role becomes the Member role at the renewal. If they must see only one project, make them guests before that date. The downgrade is now planned.",
			note: "Customer confirmed the downgrade. Flag for the account manager.",
			articleId: "change-plan",
		},
		{
			subjects: [
				"Invoices go to a former employee",
				"Change who gets our invoices",
				"Send invoices to our finance mailbox",
			],
			opening:
				"Our invoices still go to a colleague who left in the spring. Please send them to our finance mailbox from now on.",
			reply:
				"Hi {first}, an admin can change the recipients under Billing, then Invoice recipients. I can also do it for you: send me the address of the finance mailbox.",
			followUp:
				"Please use the finance mailbox that is in our company details.",
			closing:
				"Done. Invoices now go only to your finance mailbox. I removed the old recipient.",
			note: "Recipient changed on request of a workspace admin. Checked the role first.",
			articleId: "invoice-contacts",
		},
		{
			subjects: [
				"Seats still billed after we removed users",
				"Invoice counts users we removed",
				"Refund for seats we no longer use",
			],
			opening:
				"We removed six users last week, but the new invoice still counts all seats. Can you correct it?",
			reply:
				"Hi {first}, removing a user does not lower the seat count by itself. An admin must also lower the seats under Billing, then Plan. I can credit the difference for this month.",
			followUp:
				"Thank you. I lowered the seats now. Please send the credit note.",
			closing:
				"The credit note for six seats is on your account and comes off the next invoice.",
			note: "Credit approved by the lead for one month. Customer lowered seats.",
			articleId: "change-plan",
		},
		{
			subjects: [
				"Quote for an annual plan with 40 seats",
				"Need a quote for procurement",
				"Annual plan price for 40 users",
			],
			opening:
				"Our procurement team needs a quote for an annual plan with 40 seats before they can approve the purchase.",
			reply:
				"Hi {first}, I attach a quote for 40 seats on the annual Growth plan. It stays valid for 30 days. Do you need it in another currency?",
			followUp:
				"The currency is fine. Can you add our purchase order number to the quote?",
			closing:
				"Here is the quote with your purchase order number. When procurement approves it, we switch the plan on the start date.",
			note: "Quote sent from the billing console. Sales informed.",
			articleId: "annual-plans",
		},
	],
	access: [
		{
			subjects: [
				"Locked out after turning on two-factor",
				"Lost my phone, cannot pass 2FA",
				"Two-factor code is never accepted",
			],
			opening:
				"I turned on two-factor yesterday and my phone reset this morning. Now I cannot sign in at all. Help!",
			reply:
				"Hi {first}, do you have the backup codes from the setup? If not, an admin of your workspace can reset two-factor for your account in a few clicks.",
			followUp: "Our admin is on holiday. Is there another way?",
			closing:
				"I checked your identity with the account owner and reset two-factor. Sign in now, then set it up again and keep the backup codes safe.",
			note: "Identity confirmed by the owner on a call. 2FA reset from the admin console.",
			articleId: "two-factor-recovery",
		},
		{
			subjects: [
				"SSO sign-in loops back to the start page",
				"Team cannot sign in with SSO",
				"Single sign-on fails after the IdP page",
			],
			opening:
				"Since this morning our team cannot sign in with SSO. After the identity provider page we land on the sign-in page again.",
			reply:
				"Hi {first}, this usually means that the certificate of the identity provider changed. Can you check if your IT team rotated it this week?",
			followUp: "Yes, they rotated it yesterday. Where do we put the new one?",
			closing:
				"Paste the new metadata URL under Settings, then Security, then Single sign-on, and select Test. Your team can sign in again after that.",
			note: "SAML error log shows a signature mismatch. Certificate rotation on their side.",
			articleId: "sso-setup",
		},
		{
			subjects: [
				"New hire never got the invite email",
				"Invite email does not arrive",
				"Colleague cannot find the invitation",
			],
			opening:
				"We invited a new colleague two days ago, but she never got the email. We checked the spam folder too.",
			reply:
				"Hi {first}, the invite went out and your mail server accepted it. It is likely in a quarantine folder. Can your IT team allow mail from our sending domain?",
			followUp: "IT allowed the domain. Should we resend the invite now?",
			closing:
				"Yes, I resent it a minute ago. The new link is valid for 7 days. Welcome to your new colleague!",
			note: "Delivery log: accepted by the recipient server, held in quarantine.",
			articleId: "invite-emails",
		},
		{
			subjects: [
				"Change the account owner",
				"Our workspace owner left the company",
				"Transfer ownership to me",
			],
			opening:
				"The founder who created our workspace left the company. How do we make me the owner?",
			reply:
				"Hi {first}, the owner can transfer the role. When the owner left, we need a short request from an admin and a confirmation from your company domain.",
			followUp:
				"I am an admin. I sent the confirmation from my company address.",
			closing:
				"Thank you. You are now the owner of the workspace. The former owner is a member, and you can remove that account.",
			note: "Ownership change approved after domain check. Logged in the audit trail.",
			articleId: "owner-transfer",
		},
		{
			subjects: [
				"Password reset link says it expired",
				"Reset link expires at once",
				"Cannot reset my password",
			],
			opening:
				"Every password reset link that I open says that it expired, even when I click it at once.",
			reply:
				"Hi {first}, some mail scanners open links before you do, and a link works only one time. Can you copy the link into a private window of the browser?",
			followUp: "The private window did not help. Same message.",
			closing:
				"I sent a code-based reset to your address. Enter the 6-digit code on the sign-in page. Your new password works at once.",
			note: "Link scanner of the customer opens reset links. Suggested an allow rule.",
			articleId: null,
		},
		{
			subjects: [
				"Sessions end every few minutes",
				"App signs us out all the time",
				"We get logged out after 15 minutes",
			],
			opening:
				"Since Monday the app signs us out every 10 to 15 minutes. It is very hard to work like this.",
			reply:
				"Hi {first}, your workspace has an idle limit of 15 minutes under Settings, then Security, then Sessions. Did an admin change it this week?",
			followUp:
				"Our security team set it. What do you suggest for a team that works all day in the app?",
			closing:
				"We suggest 8 hours for teams that work all day in the app. Your admin can change it in the same place. The change applies at the next sign-in.",
			note: "Idle timeout set to 15 min by their admin on Monday.",
			articleId: "sessions",
		},
	],
	integrations: [
		{
			subjects: [
				"Calendar sync stopped working",
				"New bookings missing from our calendar",
				"Calendar has not synced for two days",
			],
			opening:
				"Our team calendar does not show new bookings from the app any more. The last sync was two days ago.",
			reply:
				"Hi {first}, the calendar token of your account expired. Please open Settings, then Integrations, then Calendar, and select Reconnect.",
			followUp:
				"I reconnected it. Old bookings are back, but the newest one is still missing.",
			closing:
				"The newest booking synced after the second run. Sync now runs every 10 minutes again.",
			note: "Token expired after a password change on their calendar account.",
			articleId: "calendar-sync",
		},
		{
			subjects: [
				"Webhook deliveries fail with 401",
				"Webhooks rejected since yesterday",
				"Signing secret error on webhooks",
			],
			opening:
				"All our webhook deliveries fail with 401 since yesterday. We did not change anything on our side.",
			reply:
				"Hi {first}, someone rotated the signing secret of your webhook two days ago. Your server still checks the old one. Can you update the secret on your side?",
			followUp:
				"Found it: a colleague rotated it during a test. Can you resend the failed events?",
			closing:
				"I replayed the 214 failed deliveries. All of them returned 200. Thanks for the quick check, {first}.",
			note: "Replayed failed deliveries from the webhook console.",
			articleId: "webhooks",
		},
		{
			subjects: [
				"API returns 429 during our nightly import",
				"Rate limit stops our import",
				"Can you raise our API limit?",
			],
			opening:
				"Our nightly import stops with 429 errors after about 30,000 records. Can you raise our limit?",
			reply:
				"Hi {first}, the limit is 600 requests per minute. The bulk endpoint takes 500 records in one request, so your import fits easily. Shall I send an example?",
			followUp:
				"Yes please, an example of the bulk call would help our developer.",
			closing:
				"I sent the example to your developer. With the bulk endpoint the import takes about 4 minutes and stays under the limit.",
			note: "Customer sends one request per record. Bulk endpoint solves it.",
			articleId: "api-limits",
		},
		{
			subjects: [
				"Accounting export misses some invoices",
				"12 invoices not in the accounting export",
				"Export to accounting skips one client",
			],
			opening:
				"The export to our accounting tool skipped 12 invoices last month. They are all from the same client.",
			reply:
				"Hi {first}, those invoices have no tax number on the client record, so the export holds them. You find them in the error list of the accounting integration.",
			followUp:
				"We added the tax number to the client. Do the invoices export by themselves now?",
			closing:
				"Yes. The next nightly run exported the 12 invoices. The error list is empty.",
			note: "Export validation rejects invoices without a client tax number.",
			articleId: "accounting-export",
		},
		{
			subjects: [
				"Chat alerts post to the wrong channel",
				"Alerts go to the general channel",
				"Project alerts land in the wrong place",
			],
			opening:
				"Our alerts from the app go to the general channel of our team chat in place of the project channel.",
			reply:
				"Hi {first}, each project has its own alert channel under Project settings, then Notifications. The project falls back to the general channel when that field is empty.",
			followUp: "The field was empty for three projects. I set them now.",
			closing:
				"Good. New alerts now go to the project channels. Let us know if one still goes astray.",
			note: "Fallback channel behavior. Suggest a clearer empty state to the product team.",
			articleId: null,
		},
		{
			subjects: [
				"CSV import reads the dates wrong",
				"Day and month swapped after import",
				"Imported dates are all wrong",
			],
			opening:
				"We imported 800 records from a CSV file and every date has the day and the month swapped.",
			reply:
				"Hi {first}, the importer needs the date format before the column mapping. Your file uses day first. Can you run the import again with that format?",
			followUp: "Should I delete the 800 wrong records first?",
			closing:
				"I removed the 800 records of the first import for you. Run the import again with the day-first format and the dates are correct.",
			note: "Bulk delete of import batch run on request of an admin.",
			articleId: "csv-import",
		},
	],
	bug: [
		{
			subjects: [
				"Dashboard charts show no data",
				"Charts empty since this morning",
				"Main dashboard does not load charts",
			],
			opening:
				"All charts on our main dashboard are empty since this morning. The numbers in the tables are still there.",
			reply:
				"Hi {first}, thanks for the report. We see the same issue on a few workspaces and our engineers are on it. I will update you here.",
			followUp: "Any news? Our weekly review starts in two hours.",
			closing:
				"The fix is live. The charts load again on your dashboard. Sorry for the trouble before your review, {first}.",
			note: "Linked to the incident of the chart service. Engineering deployed a fix.",
			articleId: "empty-charts",
		},
		{
			subjects: [
				"PDF export cuts the last column",
				"Report PDF is cut on the right",
				"Last column missing in PDF export",
			],
			opening:
				"When we export the monthly report to PDF, the last column is cut in half on every page.",
			reply:
				"Hi {first}, the report has 14 columns, which is too wide for portrait pages. Can you try the Landscape option in the export dialog?",
			followUp: "Landscape works, but we need portrait for our board pack.",
			closing:
				"We released a fit-to-page option this week. Select it in the export dialog and all 14 columns fit on a portrait page.",
			note: "Fit-to-page shipped in the last release. Closing the feedback loop.",
			articleId: "pdf-export",
		},
		{
			subjects: [
				"Duplicate entries after offline edits on mobile",
				"Records saved two times from mobile",
				"Offline edits create duplicates",
			],
			opening:
				"Our field team edits records on mobile without network. When they come back online, some records show up two times.",
			reply:
				"Hi {first}, this is a known issue in the old version of the mobile app. Which version do your phones run? You find it under Settings, then About.",
			followUp: "Most phones run the version from two months ago.",
			closing:
				"The update fixes the duplicate saves. For the existing duplicates, open the record and select Merge on the banner.",
			note: "Known bug fixed in the current mobile release.",
			articleId: "offline-sync",
		},
		{
			subjects: [
				"Search ignores accented letters",
				"Search finds nothing with an accent",
				"Client names with accents not found",
			],
			opening:
				"When I search for a client name with an accent, the search finds nothing. Without the accent it works.",
			reply:
				"Hi {first}, I can reproduce it. I filed it with our engineers with your example. I will update you here.",
			followUp: "Thanks. It is a problem for many of our client names.",
			closing:
				"The search now matches names with and without accents. Thanks for the clear example, it helped a lot.",
			note: "Reproduced on staging. Engineering fixed the search normalization.",
			articleId: null,
		},
		{
			subjects: [
				"Shared reports show the wrong time zone",
				"Times one hour off on shared reports",
				"Report times wrong after clock change",
			],
			opening:
				"Our colleagues abroad see times one hour off on the reports that we share with them.",
			reply:
				"Hi {first}, shared reports use the time zone of the workspace. Each person can also set a personal time zone in the profile. Is the workspace time zone correct?",
			followUp:
				"The workspace time zone is right, but the clocks changed last week.",
			closing:
				"Thanks, that was the key. A fix for the clock change is live, and the shared reports now show the right times.",
			note: "Daylight saving offset not applied to cached shared reports.",
			articleId: "time-zones",
		},
		{
			subjects: [
				"Upload stalls at 99 percent",
				"Large uploads never finish",
				"File upload stops near the end",
			],
			opening:
				"Large file uploads stop at 99 percent and never finish. Small files work.",
			reply:
				"Hi {first}, how large are the files, and do you work through a VPN? Some company proxies stop long uploads near the end.",
			followUp: "About 180 MB, and yes, we all use the company VPN.",
			closing:
				"Our logs show the VPN closes the connection after 60 seconds. Your IT team raised the timeout and the uploads now finish.",
			note: "Proxy timeout on the customer side. Shared the log lines with their IT.",
			articleId: "upload-stalls",
		},
	],
	how_to: [
		{
			subjects: [
				"How do we add an approval step?",
				"Manager approval for large purchases",
				"Can a role approve a workflow step?",
			],
			opening:
				"We want purchases above a limit to wait for a manager before they move on. Is that possible?",
			reply:
				"Hi {first}, yes. Open the workflow, select the step, and add an approver. You can add a second approver for amounts above a limit.",
			followUp: "Can the approver be a role instead of one person?",
			closing:
				"Yes: choose Anyone with the role and pick the manager role. The first manager who approves moves the record on.",
			note: "Pointed to the approval docs. Nice use case for the newsletter.",
			articleId: "approval-steps",
		},
		{
			subjects: [
				"Can a guest see only one project?",
				"Give a client access to one project",
				"Guest access for an outside partner",
			],
			opening:
				"We want to give a client access to their own project, but not to the rest of our workspace.",
			reply:
				"Hi {first}, invite the client as a guest from the Share button of the project. Guests see only the projects that you share with them.",
			followUp: "Does a guest count as a paid seat?",
			closing:
				"No, guests do not count as paid seats on your plan. You can invite as many as you need.",
			note: "Plan check: guests are free on Growth.",
			articleId: "guest-access",
		},
		{
			subjects: [
				"Bulk edit tags on many records",
				"Change the tag of 300 records at once",
				"Is there a bulk edit for tags?",
			],
			opening:
				"Is there a way to change the tag of 300 records at once? One by one takes forever.",
			reply:
				"Hi {first}, yes. Filter the list, select all, and use Edit selected. You can add or remove a tag on up to 1,000 records in one go.",
			followUp: "Found it, thanks! Can I undo it if I make a mistake?",
			closing:
				"A bulk edit has an Undo button for 10 minutes. After that, run a second bulk edit to change it back.",
			note: "No issue, quick how-to.",
			articleId: null,
		},
		{
			subjects: [
				"Send a weekly report by email",
				"Schedule the team report for Monday",
				"Email the report to our managers",
			],
			opening:
				"Our managers want the team report in their inbox every Monday morning. Can the app send it?",
			reply:
				"Hi {first}, yes. Save the report, select Schedule, and pick Monday at the hour you want. People outside the workspace get a PDF.",
			followUp: "Which time zone does the schedule use?",
			closing:
				"The schedule uses the time zone of the workspace. Yours is set correctly, so Monday 8:00 is your local time.",
			note: "Workspace time zone checked.",
			articleId: "scheduled-reports",
		},
		{
			subjects: [
				"Add custom fields to the client form",
				"Account number field on clients",
				"Can we add a region field?",
			],
			opening:
				"We need two extra fields on the client form: account number and region. How do we add them?",
			reply:
				"Hi {first}, open Settings, then Fields, then Clients, and add the two fields. A region field works best as a list of choices.",
			followUp: "Can we make the account number required?",
			closing:
				"Yes: open the field and turn on Required. Existing clients without a number show a hint until someone fills it in.",
			note: "Custom fields are on all plans.",
			articleId: null,
		},
		{
			subjects: [
				"Move data between two workspaces",
				"Merge two workspaces after a merger",
				"Move all projects to one workspace",
			],
			opening:
				"We have two workspaces after a merger. Can we move the projects of one into the other?",
			reply:
				"Hi {first}, we can move projects between workspaces of the same owner. Which projects do you want to move, and should the people move too?",
			followUp:
				"All projects, and yes, the people too. The second workspace can then close.",
			closing:
				"The move is done: 18 projects and 23 people are in your main workspace. The second workspace is closed and its plan cancelled.",
			note: "Workspace merge run by engineering after the owner confirmed.",
			articleId: "workspace-setup",
		},
	],
	other: [
		{
			subjects: [
				"Feature request: dark mode on mobile",
				"Dark mode for the mobile app?",
				"Night mode for our field team",
			],
			opening:
				"Our field team works at night. Is a dark mode for the mobile app on your plans?",
			reply:
				"Hi {first}, thanks for the idea. I added your vote to the request. Many teams ask for it, and the product team reviews it this quarter.",
			followUp: "Great. Can you tell us when it ships?",
			closing:
				"I cannot promise a date yet, but you get an email when it ships. Thanks for the feedback!",
			note: "Vote added to the dark mode request.",
			articleId: null,
		},
		{
			subjects: [
				"Security questionnaire for procurement",
				"80 security questions from procurement",
				"Help with a vendor security review",
			],
			opening:
				"Our procurement team sent a security questionnaire of 80 questions. Can your team fill it in?",
			reply:
				"Hi {first}, yes. Please attach the file. Most answers come from our security pack, and our team fills in the rest within five business days.",
			followUp: "Attached. The deadline on our side is the end of next week.",
			closing:
				"The completed questionnaire is attached, with our security pack. Your procurement team can contact us here for any follow-up.",
			note: "Security team completed the questionnaire.",
			articleId: null,
		},
		{
			subjects: [
				"Signature of the data processing agreement",
				"Need a signed DPA before go-live",
				"Countersigned data agreement",
			],
			opening:
				"Our legal team needs a signed data processing agreement before we add customer data.",
			reply:
				"Hi {first}, you can sign the standard agreement online under Settings, then Legal. Do you need changes to the standard text?",
			followUp:
				"No changes. I signed it online. Can we get the countersigned copy?",
			closing:
				"The countersigned agreement is now in Settings, then Legal, as a PDF. A copy also went to your legal contact.",
			note: "DPA countersigned by legal.",
			articleId: null,
		},
		{
			subjects: [
				"Do you have a status page?",
				"Where can we follow incidents?",
				"Subscribe to maintenance notices",
			],
			opening:
				"Our IT team wants to follow incidents. Do you have a status page that they can subscribe to?",
			reply:
				"Hi {first}, yes. The status page link is at the bottom of the help center. Your team can subscribe by email or by RSS.",
			followUp: "Found it. Do you also post planned maintenance there?",
			closing:
				"Yes, planned maintenance shows there 5 days ahead. Have a good week!",
			note: "No issue.",
			articleId: null,
		},
		{
			subjects: [
				"Training session for our new team",
				"Onboarding call for eight new users",
				"Live training next month",
			],
			opening:
				"Eight new people join our team next month. Do you offer a training session?",
			reply:
				"Hi {first}, your plan includes one live session of one hour per quarter. Which days suit your team?",
			followUp: "Tuesday or Thursday morning works best for us.",
			closing:
				"Booked for Thursday morning. The invite with the video link is in your inbox.",
			note: "Training booked with the onboarding team.",
			articleId: "invite-team",
		},
		{
			subjects: [
				"Question about the public roadmap",
				"Is offline mode for desktop coming?",
				"Can we join an early beta?",
			],
			opening:
				"Is there a public roadmap? We want to know if offline mode for the desktop app is coming.",
			reply:
				"Hi {first}, we do not publish a roadmap, but I can share that offline mode is in research. I added your team to the list of early testers.",
			followUp: "Thanks, we would love to test it.",
			closing: "Great, the product team will contact you when the beta opens.",
			note: "Added to the offline beta list.",
			articleId: null,
		},
	],
};
