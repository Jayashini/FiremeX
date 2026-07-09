const alerts = [
	{ title: 'Smoke detected', code: 'INC-4821', recipient: 'Security team', channel: 'SMS / Push', acknowledged: 'Yes' },
	{ title: 'Flame detected', code: 'INC-4820', recipient: 'Shift supervisor', channel: 'Push', acknowledged: 'No' },
	{ title: 'Heavy smoke detected', code: 'INC-4819', recipient: 'Emergency team', channel: 'SMS / Alarm', acknowledged: 'Yes' },
	{ title: 'Possible fire risk', code: 'INC-4818', recipient: 'Safety office', channel: 'Push / Alarm', acknowledged: 'No' },
] as const

export function Alerts() {
	return (
		<div class="page-grid">
			<section class="panel hero-panel alert-hero">
				<div>
					<p class="eyebrow">Alert history</p>
					<h2>Dispatched notifications</h2>
				</div>
				<div class="stat-row">
					<div class="stat-card"><strong>128</strong><span>Sent today</span></div>
					<div class="stat-card"><strong>112</strong><span>Acknowledged</span></div>
					<div class="stat-card"><strong>14</strong><span>Escalated</span></div>
				</div>
			</section>

			<section class="panel table-panel">
				<div class="panel-head">
					<h3>Notification log</h3>
					<span>By alert and incident</span>
				</div>
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>Alert</th>
								<th>Code</th>
								<th>Recipient</th>
								<th>Channel</th>
								<th>Acknowledged</th>
							</tr>
						</thead>
						<tbody>
							{alerts.map((alert) => (
								<tr>
									<td>{alert.title}</td>
									<td>{alert.code}</td>
									<td>{alert.recipient}</td>
									<td>{alert.channel}</td>
									<td><span class={`badge ${alert.acknowledged === 'Yes' ? 'success' : 'warning'}`}>{alert.acknowledged}</span></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	)
}
