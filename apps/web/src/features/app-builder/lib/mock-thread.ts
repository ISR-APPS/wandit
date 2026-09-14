/**
 * Mock chat thread of the app builder and the canned reply of a mock turn.
 * Read only by api/app-builder.services.ts.
 * Message content stays in English on purpose (docs/localization.md).
 */

import type { BuilderMessage, BuilderThread } from "../api/dto";
import type { ComposerMode } from "./constants";

export const MOCK_BUILDER_THREAD: BuilderThread = {
	projectId: "",
	turnEstimateCredits: 6,
	focusLabel: "Pass screen",
	messages: [
		{
			id: "m1",
			role: "user",
			parts: [
				{
					type: "text",
					text: "Build a membership app for Nadi Fitness in Oran. Members sign up with their phone, pay monthly with CIB or Edahabia, and check in at the door with a QR pass.",
				},
			],
		},
		{
			id: "m2",
			role: "assistant",
			parts: [
				{
					type: "text",
					text: "Members get the app; the front desk gets a web dashboard. Both share one backend. One question before I start.",
				},
				{
					type: "data-question",
					id: "q2",
					data: {
						question: "How do members pay for the monthly plan?",
						options: [
							"Card in the app · CIB and Edahabia through Chargily Pay",
							"Cash at the front desk",
							"Both",
						],
						answer: "Both",
					},
				},
			],
		},
		{
			id: "m3",
			role: "user",
			parts: [{ type: "text", text: "Both" }],
		},
		{
			id: "m4",
			role: "assistant",
			metadata: {
				followUps: [
					"Add a classes schedule with bookings",
					"Let the desk see who checked in today",
				],
			},
			parts: [
				{
					type: "data-trace",
					id: "t4",
					data: {
						seconds: 6,
						steps: [
							{ label: "Read the project brief", detail: null },
							{ label: "Planned the data model", detail: "5 tables" },
							{ label: "Chose phone OTP sign-in", detail: null },
							{ label: "Connected Chargily Pay", detail: "CIB, Edahabia" },
						],
					},
				},
				{
					type: "data-tools",
					id: "k4",
					data: {
						calls: [
							{
								kind: "think",
								label: "Thinking",
								target: "Planning sign-in and payments…",
							},
							{
								kind: "write",
								label: "Write 184 lines",
								target: "src/server/auth/otp.ts",
							},
							{ kind: "run", label: "Run migration", target: "pnpm db:push" },
							{ kind: "read", label: "Read docs", target: "chargily-pay.md" },
						],
						files: [
							{ path: "src/server/auth/otp.ts", added: 184, removed: 0 },
							{
								path: "src/server/payments/checkout.ts",
								added: 96,
								removed: 12,
							},
							{ path: "app/(auth)/phone.tsx", added: 61, removed: 0 },
						],
					},
				},
				{
					type: "text",
					text: "I set up the database and phone-OTP sign-in, connected Chargily Pay for CIB and Edahabia, and added a cash option the desk marks as paid.",
				},
				{
					type: "data-change",
					id: "c3",
					data: { title: "Added sign-in and payments", versionNumber: 3 },
				},
				{
					type: "data-suggestion",
					id: "g4",
					data: {
						title: "Want me to add a push reminder before expiry?",
						body: "Send a push 3 days before the plan ends, with a Renew now button that opens the payment screen.",
						confidence: "high",
					},
				},
			],
		},
		{
			id: "m5",
			role: "user",
			parts: [
				{
					type: "text",
					text: "Now the QR pass. Show the member's name, plan and expiry, and make the QR big enough to scan at the door.",
				},
			],
		},
		{
			id: "m6",
			role: "assistant",
			parts: [
				{
					type: "data-trace",
					id: "t6",
					data: {
						seconds: 4,
						steps: [
							{ label: "Read the pass screen brief", detail: null },
							{ label: "Checked the member table", detail: "3 columns" },
							{
								label: "Chose a signed token that rotates daily",
								detail: null,
							},
						],
					},
				},
				{
					type: "data-diff",
					id: "d6",
					data: {
						path: "app/(tabs)/pass.tsx",
						lines: [
							{
								kind: "context",
								text: "export function PassScreen({ member }: Props) {",
							},
							{ kind: "remove", text: "  const token = member.id;" },
							{
								kind: "add",
								text: "  const token = useSignedPassToken(member.id);",
							},
							{ kind: "context", text: "  return (" },
							{
								kind: "context",
								text: "    <PassCard name={member.name} plan={member.plan}>",
							},
							{
								kind: "remove",
								text: "      <QrCode value={token} size={120} />",
							},
							{
								kind: "add",
								text: "      <QrCode value={token} size={240} />",
							},
							{
								kind: "add",
								text: "      <ExpiryLine date={member.expiresAt} />",
							},
							{ kind: "context", text: "    </PassCard>" },
							{ kind: "context", text: "  );" },
						],
					},
				},
				{
					type: "data-progress",
					id: "p6",
					data: {
						title: "Building QR pass",
						percent: 64,
						steps: [
							{
								id: "s1",
								label: "Pass screen · name, plan, expiry",
								state: "done",
							},
							{
								id: "s2",
								label: "Signed QR token · rotates daily",
								state: "done",
							},
							{
								id: "s3",
								label: "Door scanner in the admin app",
								state: "active",
							},
							{
								id: "s4",
								label: "Push reminder before expiry",
								state: "pending",
							},
						],
					},
				},
				// The build paused on the scanner step to ask. The next user message answers it.
				{
					type: "data-question",
					id: "q6",
					data: {
						question: "Who scans the QR pass at the door?",
						options: [
							"The front desk, on the web dashboard",
							"A dedicated scanner phone",
							"Both",
						],
						answer: null,
					},
				},
			],
		},
	],
};

/** The assistant reply a mock turn appends. `build` also saves a version. */
export function buildMockReply(
	prompt: string,
	mode: ComposerMode,
	versionNumber: number,
): BuilderMessage {
	if (mode === "plan") {
		return {
			id: crypto.randomUUID(),
			role: "assistant",
			parts: [
				{
					type: "text",
					text: `Here is the plan for "${prompt}": I keep the current screens, add the change behind the existing backend, and show you a preview before I save a version.`,
				},
			],
		};
	}
	return {
		id: crypto.randomUUID(),
		role: "assistant",
		parts: [
			{
				type: "data-trace",
				id: crypto.randomUUID(),
				data: {
					seconds: 2,
					steps: [
						{ label: "Read the current screens", detail: null },
						{ label: "Applied the change", detail: "1 version" },
					],
				},
			},
			{
				type: "text",
				text: "Done. I updated the app and saved a version. Check the preview and tell me what to change next.",
			},
			{
				type: "data-change",
				id: crypto.randomUUID(),
				data: { title: prompt, versionNumber },
			},
		],
	};
}
