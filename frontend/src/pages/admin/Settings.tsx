import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import type { Organization, SessionUser } from '../../session'
import { authHeaders, saveUser } from '../../session'
import { PageHeader } from '../../components/common/PageHeader'
import { Card, Field, Notice, PrimaryButton, TextField } from '../../components/common/Card'

type Props = {
	user: SessionUser | null
	onNavigate: (path: string) => void
	onUserUpdated: (user: SessionUser) => void
}

type StatusItem = { ok: boolean; detail: string }
type SystemStatus = {
	database: StatusItem
	home_assistant: StatusItem
	detection: StatusItem
}

export function Settings({ user, onNavigate, onUserUpdated }: Props) {
	const [org, setOrg] = useState<Organization | null>(user?.organization ?? null)
	const [name, setName] = useState(user?.organization?.name ?? '')
	const [sector, setSector] = useState(user?.organization?.sector ?? '')
	const [email, setEmail] = useState(user?.organization?.email ?? '')
	const [phone, setPhone] = useState(user?.organization?.phone ?? '')
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')

	const [copied, setCopied] = useState(false)
	const [team, setTeam] = useState<{ active: number; pending: number } | null>(null)
	const [cameras, setCameras] = useState<{ total: number; ai: number } | null>(null)
	const [status, setStatus] = useState<SystemStatus | null>(null)

	// Everything on this page comes from endpoints that already exist. The
	// counts are read from the same lists the Users and Live Feed pages use,
	// rather than adding endpoints that only produce a number.
	useEffect(() => {
		fetch(`${API}organization`, { headers: authHeaders() })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (!d?.organization) return
				setOrg(d.organization)
				setName(d.organization.name)
				setSector(d.organization.sector)
				setEmail(d.organization.email)
				setPhone(d.organization.phone ?? '')
			})
			.catch(() => {})

		fetch(`${API}users`, { headers: authHeaders() })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => d && setTeam({ active: d.active?.length ?? 0, pending: d.pending?.length ?? 0 }))
			.catch(() => {})

		fetch(`${API}cameras`, { headers: authHeaders() })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				const list = d?.cameras ?? []
				setCameras({ total: list.length, ai: list.filter((c: any) => c.ai_enabled).length })
			})
			.catch(() => {})

		fetch(`${API}system/status`, { headers: authHeaders() })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => d && setStatus(d))
			.catch(() => {})
	}, [])

	const save = async () => {
		setMessage('')
		setError('')
		setSaving(true)
		try {
			const response = await fetch(`${API}organization`, {
				method: 'PATCH',
				headers: authHeaders(),
				body: JSON.stringify({ name, sector, email, phone })
			})
			const data = await response.json()
			if (!response.ok) {
				setError(data.error || 'Could not save the organisation.')
				return
			}
			setOrg(data.organization)
			setMessage('Organisation updated.')

			// The stored session carries the organisation too - keep it current.
			if (user) {
				const updated = { ...user, organization: data.organization }
				saveUser(updated)
				onUserUpdated(updated)
			}
		} catch {
			setError('Network error. Is the backend running?')
		} finally {
			setSaving(false)
		}
	}

	const copyCode = async () => {
		if (!org?.code) return
		try {
			await navigator.clipboard.writeText(org.code)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			<PageHeader title="Settings" subtitle="Organisation and system configuration" />

			<div class="px-10 flex flex-col gap-6 max-w-3xl">
				{/* Organisation details */}
				<Card title="Organisation" footer={<PrimaryButton label="Save changes" onClick={save} busy={saving} />}>
					<div class="flex flex-col gap-4">
						<TextField label="Name" value={name} onInput={setName} />
						<TextField label="Sector" value={sector} onInput={setSector} />
						<TextField label="Contact email" value={email} type="email" onInput={setEmail} />
						<TextField label="Phone" value={phone} onInput={setPhone} />
					</div>
					<Notice text={message} tone="ok" />
					<Notice text={error} tone="error" />
				</Card>

				{/* Join code */}
				<Card
					title="Operator join code"
					description="Share this with staff so they can request access. You approve them on the Users page."
				>
					<div class="flex items-center gap-4 flex-wrap">
						<span class="font-mono text-2xl font-bold tracking-widest text-accent bg-[#050B0D] border border-accent/30 rounded-xl px-6 py-3">
							{org?.code ?? '...'}
						</span>
						<button
							type="button"
							onClick={copyCode}
							class="text-sm text-slate-300 border border-brand-border hover:border-accent/40 rounded-xl px-4 py-2.5 transition-colors"
						>
							{copied ? 'Copied' : 'Copy'}
						</button>
					</div>
				</Card>

				{/* Team */}
				<Card
					title="Your team"
					footer={
						<button
							type="button"
							onClick={() => onNavigate('/FiremeX/admin/users')}
							class="text-sm text-accent hover:underline"
						>
							Manage users →
						</button>
					}
				>
					<div class="flex items-center gap-8">
						<div>
							<span class="block text-3xl font-bold text-slate-100">{team?.active ?? '-'}</span>
							<span class="text-xs text-slate-500 uppercase tracking-wider">Active</span>
						</div>
						<div>
							<span class={`block text-3xl font-bold ${team && team.pending > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
								{team?.pending ?? '-'}
							</span>
							<span class="text-xs text-slate-500 uppercase tracking-wider">Awaiting approval</span>
						</div>
					</div>
				</Card>

				{/* Cameras */}
				<Card
					title="Monitored cameras"
					footer={
						<button
							type="button"
							onClick={() => onNavigate('/FiremeX/admin/livefeed')}
							class="text-sm text-accent hover:underline"
						>
							Manage cameras →
						</button>
					}
				>
					<div class="flex items-center gap-8">
						<div>
							<span class="block text-3xl font-bold text-slate-100">{cameras?.total ?? '-'}</span>
							<span class="text-xs text-slate-500 uppercase tracking-wider">Cameras</span>
						</div>
						<div>
							<span class="block text-3xl font-bold text-slate-100">{cameras?.ai ?? '-'}</span>
							<span class="text-xs text-slate-500 uppercase tracking-wider">AI enabled</span>
						</div>
					</div>
				</Card>

				{/* Dependencies */}
				<Card title="System status" description="Whether the parts FiremeX depends on are reachable right now.">
					<StatusRow label="Home Assistant" item={status?.home_assistant} />
					<StatusRow label="Database" item={status?.database} />
					<StatusRow label="Detection service" item={status?.detection} />
				</Card>
			</div>
		</div>
	)
}

function StatusRow({ label, item }: { label: string; item?: StatusItem }) {
	const colour = !item ? 'bg-slate-600' : item.ok ? 'bg-emerald-500' : 'bg-red-500'
	return (
		<Field label={label}>
			<span class="flex items-center gap-2 text-sm text-slate-200">
				<span class={`inline-block w-2.5 h-2.5 rounded-full ${colour}`} />
				{item?.detail ?? 'Checking...'}
			</span>
		</Field>
	)
}
