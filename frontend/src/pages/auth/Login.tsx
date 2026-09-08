import { useState } from 'preact/hooks'
import { BASE } from '../../api'
import type { SessionUser } from '../../session'
import { saveSession } from '../../session'

type Props = {
	onNavigate: (path: string) => void
	onSignedIn: (user: SessionUser) => void
}

export function Login({ onNavigate, onSignedIn }: Props) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')

	const handleSubmit = async (e: Event) => {
		e.preventDefault()
		setError('') // Clear any old errors

		try {
			// 1. Send the email and password to the Go backend
			const response = await fetch(`${BASE}login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			})

			const data = await response.json()

			// 2. If the backend says the password is wrong
			if (!response.ok) {
				setError(data.error || 'Login failed')
				return
			}

			// 3. Success! Store the token and who we are
			saveSession(data.token, data.user)

			// 4. Admins and operators land on different pages
			onSignedIn(data.user)
		} catch (err) {
			setError('Network error. Is the backend running?')
		}
	}

	return (
		<section class="w-[450px] bg-[#21262D]/50 border border-brand-border rounded-3xl p-8 backdrop-blur-md shadow-2xl shadow-black relative mt-5">
			{/* Brand Logo & Name */}
			<div class="flex justify-center items-center gap-3 mb-10">
				<img src="/logo.png" alt="FiremeX" class="w-12 h-12 object-contain border-2 border-[#8B949E]/40 rounded-xl bg-[#14B8A6]/10 pb-1" />
				<div class="flex flex-col leading-none">
					<span class="text-lg font-bold text-slate-100 tracking-tight">Fireme<span class="text-accent">X</span></span>
					<span class="text-[10px] text-[#8B949E] mt-1 tracking-wider">Fire & Security Monitoring</span>
				</div>
			</div>

			{/* Form Header */}
			<div class="pl-2 mb-9">
				<h1 class="text-[16px] font-semibold text-slate-100">
					Sign in
				</h1>
				<p class="text-[12px] text-[#8B949E]">
					Operator & administrator access
				</p>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} class="flex flex-col gap-5">
				{/* Email */}
				<div class="flex flex-col gap-2 mb-2">
					<label htmlFor="email" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
						Email address
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
						class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
						required
					/>
				</div>

				{/* Password */}
				<div class="flex flex-col gap-2 mb-2">
					<div class="flex items-center justify-between">
						<label htmlFor="password" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
							Password
						</label>
					</div>
					<div class="relative w-full">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							value={password}
							onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
							class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl pl-4 pr-11 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
							required
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
							onClick={() => setShowPassword(!showPassword)}
						>
							{showPassword ? (
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							) : (
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							)}
						</button>
					</div>
				</div>

			{error && ( <p class="text-sm font-semibold text-red-500 text-center mb-2 animate-pulse">{error}</p>)}

				{/* Submit Button */}
				<button
					type="submit"
					class="w-full mt-4 bg-accent hover:bg-accent-hover font-semibold text-[#04201C] py-3.5 px-4 rounded-xl shadow-lg transition-all duration-200"
				>
					Sign in
				</button>
			</form>

			{/* Toggle view link */}
			<div class="mt-8 text-center">
				<button
					type="button"
					class="text-xs text-accent hover:underline"
					onClick={() => onNavigate('/FiremeX/register')}
				>
					Don't have an account? Request access / Register Organization
				</button>
			</div>
		</section>
	)
}
