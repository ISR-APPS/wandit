import { type AdminView, adminViewValues } from "@wandit/contracts";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ADMIN_VIEW_LABELS } from "@/features/users/lib/admin-view-options";

type AdminViewChecklistProps = {
	value: readonly AdminView[];
	onChange: (views: AdminView[]) => void;
	disabled?: boolean;
	idPrefix: string;
};

export function AdminViewChecklist({
	value,
	onChange,
	disabled = false,
	idPrefix,
}: AdminViewChecklistProps) {
	const selectedViews = new Set(value);

	function setChecked(view: AdminView, checked: boolean) {
		const nextViews = new Set(selectedViews);
		if (checked) {
			nextViews.add(view);
		} else {
			nextViews.delete(view);
		}

		onChange(adminViewValues.filter((item) => nextViews.has(item)));
	}

	return (
		<fieldset className="flex flex-col gap-3">
			<legend className="font-medium text-sm">Admin views</legend>
			<p className="text-muted-foreground text-sm">
				Choose the dashboard pages this support account can open.
			</p>
			<div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
				{adminViewValues.map((view) => {
					const option = ADMIN_VIEW_LABELS[view];
					const id = `${idPrefix}-${view}`;

					return (
						<Label
							key={view}
							htmlFor={id}
							className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
						>
							<Checkbox
								id={id}
								checked={selectedViews.has(view)}
								disabled={disabled}
								onCheckedChange={(checked) =>
									setChecked(view, checked === true)
								}
								className="mt-0.5"
							/>
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="font-medium text-sm">{option.label}</span>
								<span className="font-normal text-muted-foreground text-xs">
									{option.description}
								</span>
							</span>
						</Label>
					);
				})}
			</div>
		</fieldset>
	);
}
