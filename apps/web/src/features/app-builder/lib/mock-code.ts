/**
 * Mock repository of the generated app for the Code view: the file tree and
 * the content of the files the tree opens.
 * Read only by api/app-builder.services.ts.
 * Generated code stays in English on purpose (docs/localization.md).
 */

import type { CodeFile, CodeSnapshot } from "../api/dto";

export const MOCK_CODE_SNAPSHOT: CodeSnapshot = {
	branch: "main",
	defaultFilePath: "src/server/payments/checkout.ts",
	tree: [
		{
			kind: "folder",
			path: "apps",
			name: "apps",
			children: [
				{
					kind: "folder",
					path: "apps/web",
					name: "web",
					children: [
						{ kind: "file", path: "apps/web/app.tsx", name: "app.tsx" },
					],
				},
				{
					kind: "folder",
					path: "apps/admin",
					name: "admin",
					children: [
						{ kind: "file", path: "apps/admin/app.tsx", name: "app.tsx" },
					],
				},
			],
		},
		{
			kind: "folder",
			path: "src",
			name: "src",
			children: [
				{
					kind: "folder",
					path: "src/db",
					name: "db",
					children: [
						{ kind: "file", path: "src/db/schema.ts", name: "schema.ts" },
						{
							kind: "folder",
							path: "src/db/migrations",
							name: "migrations",
							children: [
								{
									kind: "file",
									path: "src/db/migrations/0001_init.sql",
									name: "0001_init.sql",
								},
							],
						},
					],
				},
				{
					kind: "folder",
					path: "src/auth",
					name: "auth",
					children: [{ kind: "file", path: "src/auth/otp.ts", name: "otp.ts" }],
				},
				{
					kind: "folder",
					path: "src/server",
					name: "server",
					children: [
						{
							kind: "folder",
							path: "src/server/payments",
							name: "payments",
							children: [
								{
									kind: "file",
									path: "src/server/payments/checkout.ts",
									name: "checkout.ts",
								},
								{
									kind: "file",
									path: "src/server/payments/webhook.ts",
									name: "webhook.ts",
								},
							],
						},
						{
							kind: "folder",
							path: "src/server/checkin",
							name: "checkin",
							children: [
								{
									kind: "file",
									path: "src/server/checkin/verify-pass.ts",
									name: "verify-pass.ts",
								},
							],
						},
					],
				},
			],
		},
		{ kind: "file", path: "wandit.config.ts", name: "wandit.config.ts" },
		{ kind: "file", path: "package.json", name: "package.json" },
	],
};

export const MOCK_CODE_FILES: CodeFile[] = [
	{
		path: "src/server/payments/checkout.ts",
		content: `import { chargily } from '../lib/chargily'
import { db, plans, payments } from '../../db'

export async function createCheckout(memberId: string, planId: string) {
  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
  if (!plan) throw new Error('Unknown plan')

  // Chargily handles CIB and Edahabia cards; amounts are in DZD
  const checkout = await chargily.checkouts.create({
    amount: plan.priceDzd,
    currency: 'dzd',
    success_url: \`\${env.APP_URL}/pass?paid=1\`,
    webhook_endpoint: \`\${env.APP_URL}/api/payments/webhook\`,
    metadata: { memberId, planId },
  })

  await db.insert(payments).values({
    memberId, planId, amountDzd: plan.priceDzd,
    status: 'pending', providerId: checkout.id,
  })

  return checkout.checkout_url
}
`,
	},
	{
		path: "src/server/payments/webhook.ts",
		content: `import { chargily } from '../lib/chargily'
import { db, payments } from '../../db'

export async function paymentsWebhook(request: Request) {
  const event = await chargily.webhooks.verify(request)

  // Chargily retries the same event; the provider id makes the update a no-op
  if (event.type === 'checkout.paid') {
    await db.update(payments)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(payments.providerId, event.data.id))
  }

  return new Response('ok')
}
`,
	},
	{
		path: "src/server/checkin/verify-pass.ts",
		content: `import { verifyToken } from '../../auth/token'
import { db, checkIns, members } from '../../db'

export async function verifyPass(token: string, scannedBy: string) {
  const { memberId } = verifyToken(token)
  const member = await db.query.members.findFirst({ where: eq(members.id, memberId) })
  if (!member || member.expiresAt < new Date()) return { ok: false }

  await db.insert(checkIns).values({ memberId, scannedBy, scannedAt: new Date() })
  return { ok: true, member }
}
`,
	},
	{
		path: "src/db/schema.ts",
		content: `import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const members = pgTable('members', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  planId: text('plan_id'),
  expiresAt: timestamp('expires_at'),
  photoUrl: text('photo_url'),
})

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceDzd: integer('price_dzd').notNull(),
  durationDays: integer('duration_days').notNull(),
})

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull(),
  amountDzd: integer('amount_dzd').notNull(),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
`,
	},
	{
		path: "src/db/migrations/0001_init.sql",
		content: `create table members (
  id text primary key,
  phone text not null unique,
  full_name text not null,
  plan_id text,
  expires_at timestamp,
  photo_url text
);
`,
	},
	{
		path: "src/auth/otp.ts",
		content: `import { sms } from '../lib/sms'

// Six digits, valid for 5 minutes, one code per phone at a time
export async function sendOtp(phone: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  await sms.send(phone, \`Nadi Fitness code: \${code}\`)
  return code
}
`,
	},
	{
		path: "apps/web/app.tsx",
		content: `import { Dashboard } from './screens/dashboard'

export function App() {
  return <Dashboard />
}
`,
	},
	{
		path: "apps/admin/app.tsx",
		content: `import { Scanner } from './screens/scanner'

export function App() {
  return <Scanner />
}
`,
	},
	{
		path: "wandit.config.ts",
		content: `export default {
  name: 'Nadi Fitness',
  languages: ['fr', 'ar', 'en'],
  backend: { region: 'eu-west-3' },
}
`,
	},
	{
		path: "package.json",
		content: `{
  "name": "nadi-fitness",
  "private": true,
  "dependencies": {
    "@tanstack/react-start": "^1.0.0",
    "drizzle-orm": "^0.44.0",
    "react": "^19.0.0"
  }
}
`,
	},
];
