type Props = {
	onNavigate: (path: string) => void
}

export function Login({ onNavigate }: Props) {
	return (
		<section class="auth-panel">
			<div class="auth-brand">
				<img src="/logo.png" alt="FiremeX" class="auth-logo" />
				<div>
					<p class="eyebrow">FiremeX</p>
					<h1>Sign in</h1>
				</div>
			</div>

			<p class="auth-copy">Operator and administrator access for the FiremeX safety platform.</p>

			<form
				class="auth-form"
				onSubmit={(event) => {
					event.preventDefault()
					onNavigate('/admin/incidents')
				}}
			>
				<label>
					<span>Email address</span>
					<input type="email" value="admin@firemex.local" readOnly />
				</label>

				<label>
					<span>Password</span>
					<input type="password" value="password123" readOnly />
				</label>

				<div class="auth-row">
					<label class="remember">
						<input type="checkbox" checked readOnly />
						<span>Remember me</span>
					</label>
					<button type="button" class="link-button">Forgot password?</button>
				</div>

				<button type="submit" class="primary-button block">Sign in</button>
			</form>
		</section>
	)
}
