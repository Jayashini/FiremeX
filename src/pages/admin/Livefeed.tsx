const cameras = [
	{ name: 'Cam C01 Main Entrance', zone: 'Lobby', status: 'Live' },
	{ name: 'Cam C03 East Corridor', zone: 'Floor 2', status: 'Motion' },
	{ name: 'Cam C07 Loading Bay', zone: 'Warehouse A', status: 'Active alarm' },
	{ name: 'Cam C09 Server Room', zone: 'Core systems', status: 'Clear' },
] as const

export function Livefeed() {
	return (
		<div class="page-grid livefeed-grid">
			<section class="panel hero-panel">
				<div>
					<p class="eyebrow">Live feed</p>
					<h2>Camera wall and alert states</h2>
				</div>
				<button type="button" class="primary-button small">+ Add camera</button>
			</section>

			<section class="camera-grid">
				{cameras.map((camera, index) => (
					<article class="camera-card panel" key={camera.name}>
						<div class="camera-topline">
							<span class="camera-name">{camera.name}</span>
							<span class="badge neutral">{camera.status}</span>
						</div>
						<div class={`camera-preview camera-preview-${index % 2}`}>
							<span>{camera.zone}</span>
						</div>
						<footer class="camera-footer">
							<span>{camera.zone}</span>
							<span>1920 x 1080</span>
						</footer>
					</article>
				))}

				<article class="panel add-camera-card">
					<span>+</span>
					<strong>Add New Camera</strong>
					<p>Configure a video source stream</p>
				</article>
			</section>
		</div>
	)
}
