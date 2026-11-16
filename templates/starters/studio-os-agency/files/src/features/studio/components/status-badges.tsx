// The status badges of Studio OS: a word plus a color for the phase, the health, a deliverable, an invoice, and a client.
// List pages, detail pages, sheets, and the overview tables render them. The maps live in lib/codes.ts.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	type ClientRelation,
	DELIVERABLE_BADGE,
	type DeliverableStatus,
	HEALTH_BADGE,
	type Health,
	INVOICE_BADGE,
	type InvoiceStatus,
	PHASE_BADGE,
	type Phase,
	RELATION_BADGE,
} from "../lib/codes";

/** The phase of a project: Discovery, Design, Production, Review, Ongoing, or Delivered. */
export function PhaseBadge({ phase }: { phase: Phase }) {
	const { t } = useT();
	return (
		<Badge variant={PHASE_BADGE[phase]}>{t(`codes.phases.${phase}`)}</Badge>
	);
}

/** The budget health of a live project. */
export function HealthBadge({ health }: { health: Health }) {
	const { t } = useT();
	return (
		<Badge variant={HEALTH_BADGE[health]}>{t(`codes.health.${health}`)}</Badge>
	);
}

/** The step of a deliverable. */
export function DeliverableBadge({ status }: { status: DeliverableStatus }) {
	const { t } = useT();
	return (
		<Badge variant={DELIVERABLE_BADGE[status]}>
			{t(`codes.deliverables.${status}`)}
		</Badge>
	);
}

/** The status of an invoice. Overdue is the only red one. */
export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
	const { t } = useT();
	return (
		<Badge variant={INVOICE_BADGE[status]}>
			{t(`codes.invoices.${status}`)}
		</Badge>
	);
}

/** The relation with a client: on retainer, project work, or dormant. */
export function RelationBadge({ relation }: { relation: ClientRelation }) {
	const { t } = useT();
	return (
		<Badge variant={RELATION_BADGE[relation]}>
			{t(`codes.relations.${relation}`)}
		</Badge>
	);
}
