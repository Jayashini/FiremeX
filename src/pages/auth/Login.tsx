import { useState } from 'preact/hooks'

type Props = {
	onNavigate: (path: string) => void
}

export function Login({ onNavigate }: Props) {
	const [email, setEmail] = useState('operator@gmail.com')
	const [password, setPassword] = useState('operator12345')
	const [showPassword, setShowPassword] = useState(false)

	const handleSubmit = (e: Event) => {
		e.preventDefault()
		onNavigate('/admin/dashboard')
	}

	return (
		<section class="w-full bg-brand-surface border border-brand-border rounded-3xl p-8 backdrop-blur-md shadow-2xl relative">
			{/* Brand Logo & Name */}
			<div class="flex items-center gap-3 mb-8">
				<img src="/logo.png" alt="FiremeX" class="w-10 h-10 object-contain rounded-xl" />
				<div class="flex flex-col leading-none">
					<span class="text-lg font-bold text-slate-100 tracking-tight">FiremeX</span>
					<span class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Fire & Security Monitoring</span>
				</div>
			</div>

			{/* Form Header */}
			<div class="mb-6">
				<h1 class="text-2xl font-bold text-slate-100">Sign in</h1>
				<p class="text-sm text-slate-400 mt-1">Operator & administrator access</p>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} class="flex flex-col gap-5">
				{/* Email */}
				<div class="flex flex-col gap-2">
					<label htmlFor="email" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
						Email address
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
						class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all placeholder-slate-600"
						required
					/>
				</div>

				{/* Password */}
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<label htmlFor="password" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
							Password
						</label>
						<button
							type="button"
							class="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
							onClick={() => alert('Reset password link sent to email.')}
						>
							Forgot password?
						</button>
					</div>
					<div class="relative w-full">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							value={password}
							onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
							class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl pl-4 pr-11 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
							required
						/>
						{/* Eye toggle icon */}
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

				{/* Remember me (subtle) */}
				<div class="flex items-center gap-2 mt-1">
					<input
						id="remember"
						type="checkbox"
						defaultChecked
						class="w-4 h-4 bg-transparent rounded border-brand-border text-accent focus:ring-accent focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
					/>
					<label htmlFor="remember" class="text-xs text-slate-400 select-none cursor-pointer">
						Keep me signed in on this device
					</label>
				</div>

				{/* Sign in Button */}
				<button
					type="submit"
					class="w-full mt-4 bg-accent hover:bg-accent-hover text-brand-bg font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all duration-200"
				>
					Sign in
				</button>
			</form>
		</section>
	)
}
