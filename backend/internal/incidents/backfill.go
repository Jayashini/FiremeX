package incidents

import "gorm.io/gorm"

// BackfillAlerts creates one notification for each incident predating alerts.
// The unique incident_id constraint makes this safe on every startup.
func BackfillAlerts(db *gorm.DB) error {
	return db.Exec(`INSERT INTO alerts (incident_id, organization_id, hazard_class, confidence, camera_name, zone, created_at)
		SELECT i.id, i.organization_id, i.class, i.confidence, i.camera_name, i.zone, i.created_at
		FROM incidents i
		ON CONFLICT (incident_id) DO NOTHING`).Error
}

// BackfillAlertActors copies existing acknowledgers' current profile labels
// once when upgrading a database that predates actor snapshots.
func BackfillAlertActors(db *gorm.DB) error {
	return db.Exec(`UPDATE alerts AS a
		SET acknowledged_by_name = u.name, acknowledged_by_role = u.role
		FROM users AS u
		WHERE a.acknowledged_by_id = u.id
		  AND a.organization_id = u.organization_id
		  AND a.acknowledged_at IS NOT NULL
		  AND (a.acknowledged_by_name IS NULL OR a.acknowledged_by_name = ''
		       OR a.acknowledged_by_role IS NULL OR a.acknowledged_by_role = '')`).Error
}

// BackfillIncidentResponseActions preserves the latest legacy response update.
// Older transitions were never stored, so they cannot be reconstructed.
func BackfillIncidentResponseActions(db *gorm.DB) error {
	return db.Exec(`INSERT INTO incident_response_actions
		(incident_id, organization_id, actor_id, actor_name, actor_role, status, note, blocker_reason, created_at)
		SELECT i.id, i.organization_id, u.id, u.name, u.role, i.status, i.resolve_note,
		       i.blocker_reason, COALESCE(i.response_updated_at, i.updated_at)
		FROM incidents AS i
		JOIN users AS u ON u.id = i.response_updated_by_id AND u.organization_id = i.organization_id
		WHERE NOT EXISTS (SELECT 1 FROM incident_response_actions AS a WHERE a.incident_id = i.id)`).Error
}
