import { HandshakeIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AffiliatesTab } from "../components/affiliates-tab";
import { CommissionsTab } from "../components/commissions-tab";
import { PayoutsTab } from "../components/payouts-tab";
import { ProgramsTab } from "../components/programs-tab";

function AffiliatesPage() {
	return (
		<div className="mx-auto w-full max-w-[1700px] space-y-5">
			<div className="flex items-start gap-3">
				<div className="mt-1 grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/40 text-muted-foreground">
					<HandshakeIcon className="size-5" />
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Growth partnerships
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">
						Affiliates
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						Manage program terms, partners, attribution, commission entries, and
						manual payouts from one operational surface.
					</p>
				</div>
			</div>

			<Tabs defaultValue="affiliates" className="gap-5">
				<div className="overflow-x-auto border-b">
					<TabsList variant="line" className="h-11 min-w-max">
						<TabsTrigger value="affiliates">Affiliates</TabsTrigger>
						<TabsTrigger value="programs">Programs</TabsTrigger>
						<TabsTrigger value="commissions">Commissions</TabsTrigger>
						<TabsTrigger value="payouts">Payouts</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="affiliates">
					<AffiliatesTab />
				</TabsContent>
				<TabsContent value="programs">
					<ProgramsTab />
				</TabsContent>
				<TabsContent value="commissions">
					<CommissionsTab />
				</TabsContent>
				<TabsContent value="payouts">
					<PayoutsTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}

export { AffiliatesPage };
