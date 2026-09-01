export const RECEIPT_PRINT_STYLES = `
@page {
	size: A4 portrait;
	margin: 10mm;
}

@media print {
	html,
	body {
		background: #ffffff !important;
	}

	body * {
		visibility: hidden !important;
	}

	body [data-slot="sidebar"] {
		display: none !important;
	}

	body [data-slot="sidebar-wrapper"] {
		display: block !important;
		min-height: 0 !important;
	}

	body [data-slot="sidebar-inset"] {
		position: static !important;
		display: block !important;
		width: 100% !important;
		margin: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
	}

	#offline-receipt-print-root,
	#offline-receipt-print-root * {
		visibility: visible !important;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	#offline-receipt-print-root {
		position: absolute !important;
		inset: 0 !important;
		width: 100% !important;
		max-width: none !important;
		min-height: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
		border: 0 !important;
		border-radius: 0 !important;
		background: #ffffff !important;
		box-shadow: none !important;
	}

	.offline-receipt-screen-only {
		display: none !important;
	}

	.offline-receipt-scroll {
		overflow: visible !important;
	}

	.offline-receipt-section,
	#offline-receipt-print-root tr {
		break-inside: avoid;
		page-break-inside: avoid;
	}

	#offline-receipt-print-root thead {
		display: table-header-group;
	}
}
`;
