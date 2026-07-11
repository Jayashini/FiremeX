import type { ComponentChildren } from 'preact'

type Props = {
	children: ComponentChildren
	maxWidthClassName?: string
}

export function AuthLayout({ children, maxWidthClassName = 'max-w-[420px]' }: Props) {
	return (
		<main class="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-bg px-4 py-8">
			{/* Subtle radial background glows */}
			<div class="absolute -top-40 -left-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.12),transparent_70%)] blur-2xl pointer-events-none" />
			<div class="absolute -bottom-40 -right-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.08),transparent_70%)] blur-2xl pointer-events-none" />
			
			<div class={`relative z-10 w-full ${maxWidthClassName}`}>
				{children}
			</div>
		</main>
	)
}
