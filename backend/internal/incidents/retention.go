package incidents

import (
	"context"
	"fmt"
	"github.com/firemex/backend/models"
	"os"
	"strings"
	"time"
)

// Cleanup also reconciles crash leftovers after a one-hour grace period.
func (s *Store) Cleanup(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var rows []models.Incident
	if err := s.DB.WithContext(ctx).Where("evidence_expires_at <= ? AND evidence_status <> ?", s.now(), "expired").Find(&rows).Error; err != nil {
		return err
	}
	for _, r := range rows {
		if r.SnapshotFile != "" {
			if err := s.Evidence.Remove(r.SnapshotFile); err != nil {
				return fmt.Errorf("evidence expiry deletion failed")
			}
		}
		if err := s.DB.WithContext(ctx).Model(&r).Updates(map[string]any{"snapshot_file": "", "evidence_status": "expired"}).Error; err != nil {
			return err
		}
	}
	entries, err := os.ReadDir(s.Evidence.Dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	root, err := s.Evidence.root()
	if err != nil {
		return err
	}
	defer root.Close()
	for _, d := range entries {
		if d.IsDir() || (!validName(d.Name()) && !strings.HasSuffix(d.Name(), ".jpg.tmp")) {
			continue
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if s.now().Sub(info.ModTime()) < time.Hour {
			continue
		}
		var n int64
		if err := s.DB.WithContext(ctx).Model(&models.Incident{}).Where("snapshot_file = ?", d.Name()).Count(&n).Error; err != nil {
			return err
		}
		if n == 0 {
			if err := root.Remove(d.Name()); err != nil {
				return err
			}
		}
	}
	return nil
}
