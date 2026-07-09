const incidents = [
	{ time: '2026-07-08 14:42', camera: 'Cam C07 - Loading Bay', zone: 'Warehouse A', confidence: '98.4%', status: 'Fire detected', action: 'Unresolved' },
	{ time: '2026-07-08 14:31', camera: 'Cam C03 - East Corridor', zone: 'Floor 2', confidence: '91.2%', status: 'Smoke detected', action: 'In progress' },
	{ time: '2026-07-08 13:58', camera: 'Cam C11 - Roofline North', zone: 'Roof Access', confidence: '88.7%', status: 'Heat anomaly', action: 'Investigating' },
	{ time: '2026-07-08 12:18', camera: 'Cam C02 - Server Room', zone: 'IT Core', confidence: '76.3%', status: 'Sensor alert', action: 'Resolved' },
] as const

export function Incidents() {
	return (
		<div class="page-grid">
			<section class="panel hero-panel">
				<div>
					<p class="eyebrow">Incident overview</p>
					<h2>Active incidents and review queue</h2>
				</div>
				<div class="metric-pill">12 open cases</div>
			</section>

			<section class="panel table-panel">
				<div class="panel-head">
					<h3>Recent incidents</h3>
					<span>Last 24 hours</span>
				</div>
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>Timestamp</th>
								<th>Camera</th>
								<th>Zone</th>
								<th>AI Confidence</th>
								<th>Status</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							{incidents.map((incident) => (
								<tr>
									<td>{incident.time}</td>
									<td>{incident.camera}</td>
									<td>{incident.zone}</td>
									<td>{incident.confidence}</td>
									<td><span class="badge danger">{incident.status}</span></td>
									<td><span class="badge neutral">{incident.action}</span></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	)
}
