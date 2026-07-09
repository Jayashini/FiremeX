import type { ComponentChildren } from 'preact'

type Props = {
	children: ComponentChildren
}

export function OperatorLayout({ children }: Props) {
	return <div class="operator-shell">{children}</div>
}
