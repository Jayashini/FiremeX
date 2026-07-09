import type { ComponentChildren } from 'preact'

type Props = {
	children: ComponentChildren
}

export function AuthLayout({ children }: Props) {
	return (
		<main class="auth-shell">
			<div class="auth-backdrop auth-backdrop-left" />
			<div class="auth-backdrop auth-backdrop-right" />
			<div class="auth-card-wrap">{children}</div>
		</main>
	)
}
