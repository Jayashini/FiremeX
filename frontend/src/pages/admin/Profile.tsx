import { useState } from 'preact/hooks'
import { API } from '../../api'
import type { SessionUser } from '../../session'
import { authHeaders, initials, saveUser } from '../../session'
import { PageHeader } from '../../components/common/PageHeader'
import { Card, Field, Notice, PrimaryButton, TextField } from '../../components/common/Card'

type Props = {
	user: SessionUser | null
	onUserUpdated: (user: SessionUser) => void
}

export function Profile({ user, onUserUpdated }: Props) {
	const [name, setName] = useState(user?.name ?? '')
	const [nameMessage, setNameMessage] = useState('')
	const [nameError, setNameError] = useState('')
	const [savingName, setSavingName] = useState(false)

	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [passwordMessage, setPasswordMessage] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [savingPassword, setSavingPassword] = useState(false)

	if (!user) return null

	const saveName = async () => {
		setNameMessage('')
		setNameError('')

		if (name.trim().length < 2) {
			setNameError('Please enter at least 2 characters.')
			return
		}

		setSavingName(true)
		try {
			const response = await fetch(`${API}me`, {
				method: 'PATCH',
				headers: authHeaders(),
				body: JSON.stringify({ name: name.trim() })
			})
			const data = await response.json()
			if (!response.ok) {
				setNameError(data.error || 'Could not update your name.')
				return
			}
			// Keep the sidebar and stored session in step with the change.
			saveUser(data.user)
			onUserUpdated(data.user)
			setNameMessage('Name updated.')
		} catch {
			setNameError('Network error. Is the backend running?')
		} finally {
			setSavingName(false)
		}
	}

	const savePassword = async () => {
		setPasswordMessage('')
		setPasswordError('')

		if (newPassword.length < 6) {
			setPasswordError('The new password must be at least 6 characters.')
			return
		}
		if (newPassword !== confirmPassword) {
			setPasswordError('The two new passwords do not match.')
			return
		}

		setSavingPassword(true)
		try {
			const response = await fetch(`${API}me/password`, {
				method: 'POST',
				headers: authHeaders(),
				body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
			})
			const data = await response.json()
			if (!response.ok) {
				setPasswordError(data.error || 'Could not change your password.')
				return
			}
			setPasswordMessage(data.message || 'Password updated.')
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
		} catch {
			setPasswordError('Network error. Is the backend running?')
		} finally {
			setSavingPassword(false)
		}
	}

	const roleLabel = user.role === 'admin' ? 'Administrator' : 'Operator'

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			<PageHeader title="Profile" subtitle="Your account and organisation" />

			<div class="px-10 flex flex-col gap-6 max-w-3xl">
				{/* Identity */}
				<section class="bg-brand-surface border border-brand-border rounded-3xl p-6 flex items-center gap-5">
					<div class="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-700 font-bold text-xl text-accent select-none shrink-0">
						{initials(user.name)}
					</div>
					<div class="flex flex-col gap-2 min-w-0">
						<span class="text-xl font-bold text-slate-100 truncate">{user.name}</span>
						<span class="text-sm text-slate-400 truncate">{user.email}</span>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/30">
								{roleLabel}
							</span>
							<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
								{user.status}
							</span>
						</div>
					</div>
				</section>

				{/* Organisation - read only here. Admins edit it in Settings. */}
				<Card
					title="Your organisation"
					description={user.role === 'admin' ? 'Edit these details in Settings.' : 'Contact your administrator to change these.'}
				>
					<Field label="Name" value={user.organization?.name} />
					<Field label="Sector" value={user.organization?.sector} />
					<Field label="Contact email" value={user.organization?.email} />
					<Field label="Phone" value={user.organization?.phone} />
				</Card>

				{/* Account */}
				<Card title="Account" footer={<PrimaryButton label="Save name" onClick={saveName} busy={savingName} />}>
					<Field label="Member since" value={user.member_since} />
					<div class="mt-3">
						<TextField label="Display name" value={name} onInput={setName} />
					</div>
					<Notice text={nameMessage} tone="ok" />
					<Notice text={nameError} tone="error" />
				</Card>

				{/* Password */}
				<Card
					title="Change password"
					description="You need your current password to set a new one."
					footer={<PrimaryButton label="Update password" onClick={savePassword} busy={savingPassword} />}
				>
					<div class="flex flex-col gap-4">
						<TextField label="Current password" type="password" value={currentPassword} onInput={setCurrentPassword} />
						<TextField label="New password" type="password" value={newPassword} onInput={setNewPassword} />
						<TextField label="Confirm new password" type="password" value={confirmPassword} onInput={setConfirmPassword} />
					</div>
					<Notice text={passwordMessage} tone="ok" />
					<Notice text={passwordError} tone="error" />
				</Card>
			</div>
		</div>
	)
}
