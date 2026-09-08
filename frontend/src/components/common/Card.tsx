import type { ComponentChildren } from 'preact'

type Props = {
	title: string
	description?: string
	children: ComponentChildren
	footer?: ComponentChildren
}

// A titled panel. Used to build the Profile and Settings pages out of
// consistent blocks instead of one long form.
export function Card({ title, description, children, footer }: Props) {
	return (
		<section class="bg-brand-surface border border-brand-border rounded-3xl overflow-hidden">
			<div class="px-6 pt-5 pb-4 border-b border-brand-border">
				<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
				{description && <p class="text-xs text-slate-500 mt-1">{description}</p>}
			</div>
			<div class="px-6 py-5">{children}</div>
			{footer && <div class="px-6 py-4 border-t border-brand-border bg-[#050B0D]/40">{footer}</div>}
		</section>
	)
}

type FieldProps = {
	label: string
	value?: string
	children?: ComponentChildren
}

/** A read-only label/value row. */
export function Field({ label, value, children }: FieldProps) {
	return (
		<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2">
			<span class="text-xs text-slate-500 uppercase tracking-wider sm:w-40 shrink-0">{label}</span>
			{children ?? <span class="text-sm text-slate-200">{value || '-'}</span>}
		</div>
	)
}

type InputProps = {
	label: string
	value: string
	type?: string
	placeholder?: string
	onInput: (value: string) => void
}

export function TextField({ label, value, type = 'text', placeholder, onInput }: InputProps) {
	return (
		<label class="flex flex-col gap-2">
			<span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				onInput={(e) => onInput((e.target as HTMLInputElement).value)}
				class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
			/>
		</label>
	)
}

/** Inline success or failure message under a form. */
export function Notice({ text, tone }: { text: string; tone: 'ok' | 'error' }) {
	if (!text) return null
	return (
		<p class={`text-sm mt-3 ${tone === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{text}</p>
	)
}

export function PrimaryButton({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
	return (
		<button
			type="button"
			disabled={busy}
			onClick={onClick}
			class="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[#04201C] py-2.5 px-5 rounded-xl text-sm transition-all"
		>
			{busy ? 'Saving...' : label}
		</button>
	)
}
