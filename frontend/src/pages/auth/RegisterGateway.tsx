import { useState, useEffect, useRef } from 'preact/hooks'
import { BASE } from '../../api'
import { COUNTRIES } from '../../constants/countries'
import { isValidPhoneForCountry } from './phoneValidation'

type Toast = { type: 'success' | 'error'; message: string } | null

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
	const [orgConfirmPassword, setOrgConfirmPassword] = useState('')
	const [orgSector, setOrgSector] = useState('Industrial')
	const [orgPhone, setOrgPhone] = useState('')
	const [orgCountry, setOrgCountry] = useState('')

	// Operator form states
	const [operatorName, setOperatorName] = useState('')
	const [operatorEmail, setOperatorEmail] = useState('')
	const [operatorPassword, setOperatorPassword] = useState('')
	const [operatorConfirmPassword, setOperatorConfirmPassword] = useState('')
	const [orgCode, setOrgCode] = useState('')
	const [accessReason, setAccessReason] = useState('')

	const [toast, setToast] = useState<Toast>(null)
	const [toastVisible, setToastVisible] = useState(false)
	const [loading, setLoading] = useState(false)
	const organizationSubmitting = useRef(false)

	const showToast = (type: 'success' | 'error', message: string) => {
		setToast({ type, message })
		setToastVisible(true)
	}

	useEffect(() => {
		if (!toastVisible) return
		const timer = setTimeout(() => {
			setToastVisible(false)
			setTimeout(() => setToast(null), 400)
		}, 5000)
		return () => clearTimeout(timer)
	}, [toastVisible, toast])

	const handleOrgSubmit = async (e: Event) => {
		e.preventDefault()

		if (organizationSubmitting.current) return

		if (orgPassword !== orgConfirmPassword) {
			showToast('error', 'Passwords do not match')
			return
		}

		if (!isValidPhoneForCountry(orgPhone, orgCountry)) {
			showToast('error', 'Contact number format mismatch')
			return
		}

		organizationSubmitting.current = true
		setLoading(true)

		try {
			const response = await fetch(`${BASE}register/organization`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					org_name: orgName,
					sector: orgSector,
					email: orgEmail,
					phone: orgPhone,
					country: orgCountry,
					admin_name: orgAdminName,
					password: orgPassword
				})
			})

			const data = await response.json()

			if (!response.ok) {
				showToast('error', data.error || 'Registration failed')
				setLoading(false)
				return
			}

			showToast('success', `Organization "${orgName}" registered! Org Code: ${data.org_code}`)
			setTimeout(() => onNavigate('/FiremeX/login'), 2500)
		} catch (err) {
			showToast('error', 'Network error. Is the backend running?')
		} finally {
			organizationSubmitting.current = false
			setLoading(false)
		}
	}

	const handleOperatorSubmit = async (e: Event) => {
		e.preventDefault()

		if (!/^[A-Z]{3}-[0-9]{3}$/.test(orgCode)) {
			showToast('error', 'Organization code must be 3 uppercase letters, a hyphen, and 3 numbers (e.g. ORG-100)')
			return
		}

		if (operatorPassword !== operatorConfirmPassword) {
			showToast('error', 'Passwords do not match')
			return
		}

		setLoading(true)

		try {
			const response = await fetch(`${BASE}register/operator`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: operatorName,
					email: operatorEmail,
					password: operatorPassword,
					org_code: orgCode
				})
			})

			const data = await response.json()

			if (!response.ok) {
				showToast('error', data.error || 'Registration failed')
				setLoading(false)
				return
			}

			showToast('success', 'Access request submitted! Pending approval from the organization administrator.')
			setTimeout(() => onNavigate('/FiremeX/login'), 2500)
		} catch (err) {
			showToast('error', 'Network error. Is the backend running?')
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			{toast && (
				<div
					style={{
						position: 'fixed',
						top: '24px',
						left: '50%',
						transform: toastVisible
							? 'translateX(-50%) translateY(0)'
							: 'translateX(-50%) translateY(-16px)',
						zIndex: 9999,
						minWidth: '320px',
						maxWidth: '480px',
						width: 'max-content',
						opacity: toastVisible ? 1 : 0,
						transition: 'opacity 0.35s ease, transform 0.35s ease',
					}}
				>
					<div
						style={{
							background: '#242C32',
							border: 'none',
							borderRadius: '8px',
							boxShadow: toast.type === 'success'
								? '0 8px 32px rgba(0,230,118,0.12)'
								: '0 8px 32px rgba(255,64,80,0.12)',
							padding: '16px 20px 14px',
							overflow: 'hidden',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
							<div style={{
								flexShrink: 0,
								width: '22px', height: '22px',
								borderRadius: '50%',
								background: toast.type === 'success' ? 'rgba(0,230,118,0.12)' : 'rgba(255,64,80,0.12)',
								display: 'flex', alignItems: 'center', justifyContent: 'center',
								marginTop: '2px',
							}}>
								{toast.type === 'success' ? (
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E676" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>
								) : (
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF4050" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
								)}
							</div>
							<div style={{ flex: 1 }}>
								<p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F1F1F1', letterSpacing: '0.01em', marginBottom: '4px', lineHeight: '1.3' }}>
									{toast.type === 'success' ? 'Registration Successful' : 'Registration Failed'}
								</p>
								<p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: '#A7ADB2', lineHeight: '1.55' }}>
									{toast.message}
								</p>
							</div>
							<button
								onClick={() => { setToastVisible(false); setTimeout(() => setToast(null), 400) }}
								style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#A7ADB2', padding: '2px', opacity: 0.7, marginTop: '2px' }}
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
							</button>
						</div>
						<div style={{ marginTop: '12px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
							<div style={{ height: '100%', background: toast.type === 'success' ? '#00E676' : '#FF4050', width: toastVisible ? '0%' : '100%', transition: toastVisible ? 'width 5s linear' : 'none' }} />
						</div>
					</div>
				</div>
			)}
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
										placeholder="Enter Org Name"
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
									placeholder="Enter Organization Email"
									value={orgEmail}
									onInput={(e) => setOrgEmail((e.target as HTMLInputElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Country</label>
								<select
									value={orgCountry}
									onChange={(e) => setOrgCountry((e.target as HTMLSelectElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								>
									<option value="">Select Country</option>
									{COUNTRIES.map((c) => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
							</div>


							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</label>
								<input
									type="tel"
									placeholder="Enter Organization Contact Number"
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
										placeholder="Enter Administrator Name"
										value={orgAdminName}
										onInput={(e) => setOrgAdminName((e.target as HTMLInputElement).value)}
										class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
										required
									/>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

									<div class="flex flex-col gap-1.5">
										<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
										<div class="relative w-full">
											<input
												type={showPassword ? 'text' : 'password'}
												placeholder="••••••••••••"
												value={orgConfirmPassword}
												onInput={(e) => setOrgConfirmPassword((e.target as HTMLInputElement).value)}
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
							</div>



							<button
								type="submit"
								disabled={loading}
								class="w-full mt-4 bg-accent hover:bg-accent-hover font-semibold text-[#04201C] py-3 px-4 rounded-xl shadow-lg transition-all duration-200 text-xs disabled:opacity-50"
							>
								{loading ? 'Registering...' : 'Complete Registration'}
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
										pattern="[A-Z]{3}-[0-9]{3}"
										maxLength={7}
										title="Enter 3 uppercase letters, a hyphen, and 3 numbers (e.g. ORG-100)"
										class="w-full bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all font-mono"
										required
									/>

								</div>
								<p class="text-[9px] text-slate-400">Enter 3 uppercase letters, a hyphen, and 3 numbers (e.g. ORG-100). Ask your Organization Administrator for the code.</p>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operator Name</label>
								<input
									type="text"
									placeholder="Enter Name"
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
									placeholder="name@domain.com"
									value={operatorEmail}
									onInput={(e) => setOperatorEmail((e.target as HTMLInputElement).value)}
									class="bg-[#050B0D]/80 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
									required
								/>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
									<label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
									<div class="relative w-full">
										<input
											type={showPassword ? 'text' : 'password'}
											placeholder="••••••••••••"
											value={operatorConfirmPassword}
											onInput={(e) => setOperatorConfirmPassword((e.target as HTMLInputElement).value)}
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
								disabled={loading}
								class="w-full mt-4 bg-accent hover:bg-accent-hover font-semibold text-[#04201C] py-3 px-4 rounded-xl shadow-lg transition-all duration-200 text-xs disabled:opacity-50"
							>
								{loading ? 'Requesting...' : 'Request Operators Access'}
							</button>
						</form>
					</section>
				)}
			</div>
		</>
	)
}
