type LeadSkuCellProps = {
	productSku: string | null;
};

export function LeadSkuCell({ productSku }: LeadSkuCellProps) {
	return (
		<span
			dir="ltr"
			className="block max-w-32 truncate font-mono text-xs"
			title={productSku ?? undefined}
		>
			{productSku ?? "—"}
		</span>
	);
}

type LeadSkuMobileMetaProps = {
	afterSku: string;
	beforeSku: readonly (string | null)[];
	productSku: string | null;
	skuLabel: string;
};

export function LeadSkuMobileMeta({
	afterSku,
	beforeSku,
	productSku,
	skuLabel,
}: LeadSkuMobileMetaProps) {
	const visibleBeforeSku = beforeSku.filter((part) => part !== null);

	return (
		<span className="min-w-0 truncate text-muted-foreground text-xs">
			{visibleBeforeSku.join(" · ")}
			{visibleBeforeSku.length > 0 ? " · " : null}
			{productSku ? (
				<>
					<bdi dir="ltr">
						{skuLabel}: {productSku}
					</bdi>
					{" · "}
				</>
			) : null}
			{afterSku}
		</span>
	);
}
