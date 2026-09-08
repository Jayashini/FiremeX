export function Footer() {
	return (
		<footer class="w-full border-t border-[#8B949E]/10 bg-brand-surface/20 py-5 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
			<div class="flex flex-wrap items-center gap-3">
				<span class="font-medium text-slate-400">© 2026 FiremeX</span>
				<span class="text-slate-700">|</span>
				<span>Enterprise Safety Operations</span>
			</div>

			<div class="flex items-center gap-6">

				<div class="flex items-center gap-4">
					<a href="#" onClick={(e) => { e.preventDefault(); alert('Opening Documentation...'); }} class="hover:text-accent transition-colors font-medium">Documentation</a>
					<a href="#" onClick={(e) => { e.preventDefault(); alert('Opening Support...'); }} class="hover:text-accent transition-colors font-medium">Support</a>
				</div>
			</div>
		</footer>
	)
}
