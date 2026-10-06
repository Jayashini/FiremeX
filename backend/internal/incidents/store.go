package incidents

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/internal/inference"
	"github.com/firemex/backend/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"sync"
	"time"
)

var ErrDisabled = errors.New("camera disabled or deleted")

type Store struct {
	DB                  *gorm.DB
	Evidence            *Evidence
	Cooldown, Retention time.Duration
	Now                 func() time.Time
	mu                  sync.Mutex
}

func (s *Store) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

// Save serializes cooldown checks in the single worker-owning process. A DB unique key
// additionally protects retries, including retries after an uncertain commit outcome.
func (s *Store) Save(ctx context.Context, cam models.Camera, f cameras.Frame, r inference.Result, thresholds map[string]float64) (int, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	count := 0
	warning := ""
	for _, label := range []string{"fire", "smoke"} {
		ds := []inference.Detection{}
		score := 0.0
		for _, d := range r.Detections {
			if d.Label == label && d.Confidence >= thresholds[label] {
				ds = append(ds, d)
				if d.Confidence > score {
					score = d.Confidence
				}
			}
		}
		if len(ds) == 0 {
			continue
		}
		key := fmt.Sprintf("%d:%d:%s:%s", cam.OrganizationID, cam.ID, f.SampleID, label)
		path := ""
		inserted := false
		err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			// Lock the camera against a simultaneous disable/delete through the API.
			var current models.Camera
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND organization_id = ? AND ai_enabled = ?", cam.ID, cam.OrganizationID, true).First(&current).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrDisabled
				}
				return err
			}
			var n int64
			if err := tx.Model(&models.Incident{}).Where("idempotency_key = ?", key).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				return nil
			}
			if err := tx.Model(&models.Incident{}).Where("organization_id = ? AND camera_id = ? AND class = ? AND created_at > ?", cam.OrganizationID, cam.ID, label, s.now().Add(-s.Cooldown)).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				return nil
			}
			image := f.Data
			state := "unannotated"
			if r.AnnotatedImage != "" {
				var err error
				image, err = base64.StdEncoding.DecodeString(r.AnnotatedImage)
				if err != nil {
					return err
				}
				state = "available"
			}
			var err error
			path, err = s.Evidence.Write(image)
			if err != nil {
				state = "missing"
				warning = "evidence could not be stored: " + err.Error()
			}
			encoded, _ := json.Marshal(ds)
			now := s.now()
			expiry := now.Add(s.Retention)
			threshold := thresholds[label]
			row := models.Incident{OrganizationID: cam.OrganizationID, CameraID: cam.ID, CameraName: current.DisplayName, Zone: current.Zone, Class: label, Confidence: score, Detections: string(encoded), SnapshotFile: path, Status: models.IncidentStatusUnresolved, ReviewStatus: "unconfirmed", SampleID: f.SampleID, IdempotencyKey: &key, ObservedAt: &f.ReceivedAt, ModelVersion: r.ModelVersion, ThresholdUsed: &threshold, EvidenceStatus: state, EvidenceExpiresAt: &expiry, CreatedAt: now}
			if err = tx.Create(&row).Error; err != nil {
				return err
			}
			inserted = true
			return nil
		})
		if err == nil && inserted {
			count++
		}
		if err != nil {
			// A failed commit may have succeeded on the server. Remove only after a
			// successful read establishes that no committed incident owns the file.
			if path != "" {
				var owners int64
				if e := s.DB.WithContext(ctx).Model(&models.Incident{}).Where("snapshot_file = ?", path).Count(&owners).Error; e == nil && owners == 0 {
					s.Evidence.Remove(path)
				}
			}
			return count, warning, err
		}
	}
	return count, warning, nil
}
