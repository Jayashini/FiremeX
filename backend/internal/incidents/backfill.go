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
