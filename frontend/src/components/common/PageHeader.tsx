import type { ComponentChildren } from 'preact'

type Props = {
	title: string
	subtitle?: string
	children?: ComponentChildren
}

// The header every page uses, so titles and spacing stay consistent.
export function PageHeader({ title, subtitle, children }: Props) {
	return (
		<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
			<div>
				<h1 class="text-2xl font-bold text-slate-100">{title}</h1>
				{subtitle && <p class="text-sm text-[#8B949E] mt-1">{subtitle}</p>}
			</div>
			{children && <div class="flex items-center gap-3 self-end sm:self-auto">{children}</div>}
		</header>
	)
}
