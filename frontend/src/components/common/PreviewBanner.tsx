type Props = {
	/** What is not real yet, e.g. "incidents". */
	what: string
}

// Shown on pages that still display sample rows.
//
// These screens were designed before the detection service existed, so the
// data in them is illustrative. Saying so plainly is better than letting
// someone read invented numbers as real readings.
export function PreviewBanner({ what }: Props) {
	return (
		<div class="mx-6 flex items-start gap-3 bg-amber-500/5 border border-amber-500/25 rounded-2xl px-4 py-3">
			<svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="text-xs text-amber-200/80 leading-relaxed">
				<span class="font-bold text-amber-300">Preview</span> — the {what} below are sample data used to design this page.
				Real {what} will appear here once the detection service is connected.
			</p>
		</div>
	)
}
