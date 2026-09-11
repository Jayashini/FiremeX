export function Footer() {
	return (
		<footer class="w-full border-t border-[#8B949E]/10 bg-brand-surface/20 py-5 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
			<div class="flex flex-wrap items-center gap-3">
				<span class="font-medium text-slate-400">© 2026 FiremeX</span>
				<span class="text-slate-700">|</span>
				<span>Enterprise Safety Operations</span>
			</div>

			<div class="flex items-center gap-6">

				{/* Documentation and Support links were here. Both only showed
				    an alert saying they were opening something, which never
				    happened. Removed until there is somewhere real to point at. */}
				<span class="text-[11px] text-slate-600">v0.1 - development build</span>
			</div>
		</footer>
	)
}
