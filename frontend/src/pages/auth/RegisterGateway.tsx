import { useState } from 'preact/hooks'

type Props = {
	onNavigate: (path: string) => void
}

type RegistrationType = 'select' | 'organization' | 'operator'

export function RegisterGateway({ onNavigate }: Props) {
	const [step, setStep] = useState<RegistrationType>('select')
	const [showPassword, setShowPassword] = useState(false)

	// Organization form states
	const [orgName, setOrgName] = useState('')
	const [orgEmail, setOrgEmail] = useState('')
	const [orgAdminName, setOrgAdminName] = useState('')
	const [orgPassword, setOrgPassword] = useState('')
	const [orgSector, setOrgSector] = useState('Industrial')
	const [orgPhone, setOrgPhone] = useState('')

	// Operator form states
	const [operatorName, setOperatorName] = useState('')
	const [operatorEmail, setOperatorEmail] = useState('')
	const [operatorPassword, setOperatorPassword] = useState('')
	const [orgCode, setOrgCode] = useState('')
	const [accessReason, setAccessReason] = useState('')

	const handleOrgSubmit = (e: Event) => {
		e.preventDefault()
		// Save organization to localStorage
		const savedOrgs = localStorage.getItem('firemex_organizations')
		const orgs = savedOrgs ? JSON.parse(savedOrgs) : [
			{ id: 'ORG-101', name: 'SafeGuard Industries', sector: 'Industrial', email: 'admin@safeguard.com' },
			{ id: 'ORG-102', name: 'Metro Health Center', sector: 'Healthcare', email: 'admin@metrohealth.com' }
		]

		const generatedCode = `ORG-${Math.floor(100 + Math.random() * 900)}`
		const newOrg = {
			id: generatedCode,
			name: orgName,
			sector: orgSector,
			email: orgEmail,
			adminName: orgAdminName,
			phone: orgPhone,
			date: new Date().toISOString().split('T')[0]
		}

		localStorage.setItem('firemex_organizations', JSON.stringify([...orgs, newOrg]))
		alert(`Organization "${orgName}" registered successfully!\nYour unique Organization Code is: ${generatedCode}\nOperators can use this code to join your team.`)
		onNavigate('/login')
	}

	const handleOperatorSubmit = (e: Event) => {
		e.preventDefault()
		// Save pending operator request to localStorage
		const savedPending = localStorage.getItem('firemex_pending_users')
		const pending = savedPending ? JSON.parse(savedPending) : [
			{ id: 'usr-101', name: 'Bob Johnson', email: 'bob@gmail.com', role: 'Operator', date: '2026-07-09', orgCode: 'ORG-101' },
			{ id: 'usr-102', name: 'Alice Williams', email: 'alice@gmail.com', role: 'Operator', date: '2026-07-10', orgCode: 'ORG-102' }
		]

		const newRequest = {
			id: `usr-${Date.now()}`,
			name: operatorName,
			email: operatorEmail,
			role: 'Operator',
			orgCode: orgCode,
			reason: accessReason,
			date: new Date().toISOString().split('T')[0]
		}

		localStorage.setItem('firemex_pending_users', JSON.stringify([...pending, newRequest]))
		alert('Operator access request submitted successfully! Pending approval from the organization administrator.')
		onNavigate('/login')
	}

	return (
		<div class="w-full flex flex-col items-center">
			{/* Brand Logo & Name */}
			<div class="flex justify-center items-center gap-3 mb-8">
				<img src="/logo.png" alt="FiremeX" class="w-12 h-12 object-contain border-2 border-[#8B949E]/40 rounded-xl bg-[#14B8A6]/10 pb-1" />
				<div class="flex flex-col leading-none">
					<span class="text-lg font-bold text-slate-100 tracking-tight">Fireme<span class="text-accent">X</span></span>
					<span class="text-[10px] text-[#8B949E] mt-1 tracking-wider">Fire & Security Monitoring</span>
				</div>
			</div>

			{step === 'select' && (
				<section class="w-full bg-[#21262D]/40 border border-brand-border rounded-3xl p-8 backdrop-blur-md shadow-2xl shadow-black relative mt-2 transition-all">
					<div class="text-center mb-8">
						<h1 class="text-xl font-bold text-slate-100 tracking-tight mb-2">Create Your Account</h1>
						<p class="text-xs text-[#8B949E]">Select how you would like to register with the FiremeX system</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Card A: Register as an Organization */}
						<div
							onClick={() => setStep('organization')}
							class="group relative flex flex-col justify-between p-6 rounded-2xl border border-brand-border bg-[#0B1215]/80 hover:bg-[#0E171A] hover:border-accent/40 cursor-pointer transition-all duration-300 shadow-md hover:shadow-accent/5"
						>
							<div>
								<div class="flex items-center justify-center w-12 h-12 rounded-xl bg-[#14B8A6]/10 text-accent group-hover:bg-accent group-hover:text-[#060B0D] transition-all duration-300 mb-5">
									<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
									</svg>
								</div>

								<h3 class="text-sm font-semibold text-slate-100 group-hover:text-accent transition-colors mb-2">Register as an Organization</h3>
								<p class="text-xs text-[#8B949E] leading-relaxed mb-4">
									Create a new organization profile, set up your dashboard, configure security hardware, and manage operator teams.
								</p>
							</div>

							<div>
								<div class="flex gap-1.5 mb-4">
									<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-accent font-medium">Administrator</span>
									<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-accent font-medium">Full Control</span>
								</div>

								<div class="w-full text-center py-2.5 rounded-xl border border-accent/20 bg-accent/5 group-hover:bg-accent group-hover:text-[#060B0D] text-xs font-semibold text-accent transition-all duration-300">
									Select Organization
								</div>
							</div>
						</div>

						{/* Card B: Register as an Operator */}
						<div
							onClick={() => setStep('operator')}
							class="group relative flex flex-col justify-between p-6 rounded-2xl border border-brand-border bg-[#0B1215]/80 hover:bg-[#0E171A] hover:border-accent/40 cursor-pointer transition-all duration-300 shadow-md hover:shadow-accent/5"
						>
							<div>
								<div class="flex items-center justify-center w-12 h-12 rounded-xl bg-[#14B8A6]/10 text-accent group-hover:bg-accent group-hover:text-[#060B0D] transition-all duration-300 mb-5">
									<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
									</svg>
								</div>

								<h3 class="text-sm font-semibold text-slate-100 group-hover:text-accent transition-colors mb-2">Register as an Operator</h3>
								<p class="text-xs text-[#8B949E] leading-relaxed mb-4">
									Request access to join an existing organization to monitor fire devices, respond to incidents, and manage logs.
								</p>
							</div>

							<div>
								<div class="flex gap-1.5 mb-4">
									<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-accent font-medium">Operator / Monitor</span>
									<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-accent font-medium">Requires Org Code</span>
								</div>

								<div class="w-full text-center py-2.5 rounded-xl border border-accent/20 bg-accent/5 group-hover:bg-accent group-hover:text-[#060B0D] text-xs font-semibold text-accent transition-all duration-300">
									Select Operator
								</div>
							</div>
						</div>
					</div>

					<div class="mt-8 text-center border-t border-brand-border/40 pt-5">
						<button
							type="button"
							onClick={() => onNavigate('/FiremeX/login')}
							class="text-xs text-[#8B949E] hover:text-accent hover:underline transition-colors"
						>
							Already have an account? Sign in
						</button>
					</div>
				</section>
			)}

			{step === 'organization' && (
				<section class="w-[500px] max-w-full bg-[#21262D]/50 border border-brand-border rounded-3xl p-8 backdrop-blur-md shadow-2xl shadow-black relative mt-2 transition-all">
					<div class="flex items-center gap-2 mb-6">
						<button
							type="button"
							onClick={() => setStep('select')}
							class="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div>
							<h1 class="text-md font-bold text-slate-100">Register Organization</h1>
							<p class="text-[10px] text-[#8B949E]">Step 2 of 2: Organization Profile</p>
						</div>
					</div>

					<form onSubmit={handleOrgSubmit} class="flex flex-col gap-4">
						<div class="grid grid-cols-2 gap-4">
							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Org Name</label>
								<input
									type="text"
									placeholder="Acme Corp"
									value={orgName}
									onInput={(e) => setOrgName((e.target as HTMLInputElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sector</label>
								<select
									value={orgSector}
									onChange={(e) => setOrgSector((e.target as HTMLSelectElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
								>
									<option value="Industrial">Industrial</option>
									<option value="Commercial">Commercial</option>
									<option value="Healthcare">Healthcare</option>
									<option value="Residential">Residential</option>
								</select>
							</div>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Business Email</label>
							<input
								type="email"
								placeholder="contact@company.com"
								value={orgEmail}
								onInput={(e) => setOrgEmail((e.target as HTMLInputElement).value)}
								class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
								required
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</label>
							<input
								type="tel"
								placeholder="+1 (555) 019-2834"
								value={orgPhone}
								onInput={(e) => setOrgPhone((e.target as HTMLInputElement).value)}
								class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
								required
							/>
						</div>

						<div class="border-t border-brand-border/40 my-2 pt-2">
							<h3 class="text-xs font-semibold text-slate-300 mb-3">Administrator Credentials</h3>

							<div class="flex flex-col gap-1.5 mb-3">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Admin Name</label>
								<input
									type="text"
									placeholder="Jane Doe"
									value={orgAdminName}
									onInput={(e) => setOrgAdminName((e.target as HTMLInputElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Password</label>
								<div class="relative w-full">
									<input
										type={showPassword ? 'text' : 'password'}
										placeholder="••••••••••••"
										value={orgPassword}
										onInput={(e) => setOrgPassword((e.target as HTMLInputElement).value)}
										class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl pl-4 pr-11 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
										required
									/>
									<button
										type="button"
										class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? (
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
											</svg>
										) : (
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
										)}
									</button>
								</div>
							</div>
						</div>

						<button
							type="submit"
							class="w-full mt-4 bg-accent hover:bg-accent-hover font-semibold text-[#04201C] py-3 px-4 rounded-xl shadow-lg transition-all duration-200 text-xs"
						>
							Complete Registration
						</button>
					</form>
				</section>
			)}

			{step === 'operator' && (
				<section class="w-[500px] max-w-full bg-[#21262D]/50 border border-brand-border rounded-3xl p-8 backdrop-blur-md shadow-2xl shadow-black relative mt-2 transition-all">
					<div class="flex items-center gap-2 mb-6">
						<button
							type="button"
							onClick={() => setStep('select')}
							class="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div>
							<h1 class="text-md font-bold text-slate-100">Join as an Operator</h1>
							<p class="text-[10px] text-[#8B949E]">Step 2 of 2: Operator Registration</p>
						</div>
					</div>

					<form onSubmit={handleOperatorSubmit} class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Organization Code</label>
							<div class="relative">
								<input
									type="text"
									placeholder="e.g. ORG-101"
									value={orgCode}
									onInput={(e) => setOrgCode((e.target as HTMLInputElement).value)}
									class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all font-mono"
									required
								/>
								<span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Required</span>
							</div>
							<p class="text-[9px] text-slate-400">Ask your Organization Administrator for their registration ID.</p>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operator Name</label>
							<input
								type="text"
								placeholder="John Smith"
								value={operatorName}
								onInput={(e) => setOperatorName((e.target as HTMLInputElement).value)}
								class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
								required
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your Email</label>
							<input
								type="email"
								placeholder="operator@domain.com"
								value={operatorEmail}
								onInput={(e) => setOperatorEmail((e.target as HTMLInputElement).value)}
								class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
								required
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Password</label>
							<div class="relative w-full">
								<input
									type={showPassword ? 'text' : 'password'}
									placeholder="••••••••••••"
									value={operatorPassword}
									onInput={(e) => setOperatorPassword((e.target as HTMLInputElement).value)}
									class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl pl-4 pr-11 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
									onClick={() => setShowPassword(!showPassword)}
								>
									{showPassword ? (
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
										</svg>
									) : (
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									)}
								</button>
							</div>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reason for Request</label>
							<textarea
								placeholder="e.g. Monitoring team agent on shift C."
								value={accessReason}
								onInput={(e) => setAccessReason((e.target as HTMLTextAreaElement).value)}
								rows={2}
								class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none"
							/>
						</div>

						<button
							type="submit"
							class="w-full mt-4 bg-accent hover:bg-accent-hover font-semibold text-[#04201C] py-3 px-4 rounded-xl shadow-lg transition-all duration-200 text-xs"
						>
							Request Operators Access
						</button>
					</form>
				</section>
			)}
		</div>
	)
}
