// Package detection runs one fair, serial inference scheduler per backend process.
package detection

import (
	"context"
	"errors"
	"github.com/firemex/backend/config"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/internal/incidents"
	"github.com/firemex/backend/internal/inference"
	"github.com/firemex/backend/models"
	"gorm.io/gorm"
	"math"
	"sort"
	"sync"
	"time"
)

type Status struct {
	CameraID        uint       `json:"camera_id"`
	State           string     `json:"state"`
	Failure         string     `json:"failure,omitempty"`
	LastImage       *time.Time `json:"last_image_receipt"`
	LastInference   *time.Time `json:"last_inference_completion"`
	LastPersistence *time.Time `json:"last_persistence_success"`
	NextDue         time.Time  `json:"next_due"`
	DurationMS      int64      `json:"duration_ms"`
	LostResults     uint64     `json:"lost_results"`
	LastSampleID    string     `json:"last_sample_id,omitempty"`
}
type Worker struct {
	DB               *gorm.DB
	Snapshots        *cameras.Service
	Model            *inference.Client
	Store            *incidents.Store
	Config           config.Config
	mu               sync.Mutex
	inferenceMu      sync.Mutex
	statuses         map[uint]Status
	cameras          []models.Camera
	activeID         uint
	cancel           context.CancelFunc
	storageWarning   string
	discoveryWarning string
}

func New(db *gorm.DB, snap *cameras.Service, model *inference.Client, store *incidents.Store, c config.Config) *Worker {
	return &Worker{DB: db, Snapshots: snap, Model: model, Store: store, Config: c, statuses: map[uint]Status{}}
}
func (w *Worker) Status(cam models.Camera) Status {
	w.mu.Lock()
	defer w.mu.Unlock()
	s := w.statuses[cam.ID]
	s.CameraID = cam.ID
	if !w.Config.DetectionEnabled || !cam.AiEnabled {
		s.State = "monitoring disabled"
	} else if cam.SourceType == "browser" && (s.LastImage == nil || time.Since(*s.LastImage) > 2*w.Config.DetectionInterval+5*time.Second) {
		s.State = "waiting for browser"
		s.Failure = "Keep the Live Feed page open to send webcam frames for AI detection."
	} else if w.discoveryWarning != "" {
		s.State = "storage error"
		s.Failure = w.discoveryWarning
	} else if s.State == "" {
		s.State = "starting"
	} else if s.State == "monitoring" && time.Now().After(s.NextDue.Add(w.Config.DetectionInterval)) {
		s.State = "over capacity"
	}
	return s
}
func (w *Worker) Warnings() (string, string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.storageWarning, w.discoveryWarning
}
func (w *Worker) Cancel(id uint) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.activeID == id && w.cancel != nil {
		w.cancel()
	}
	delete(w.statuses, id)
}
func (w *Worker) update(s Status) { w.mu.Lock(); w.statuses[s.CameraID] = s; w.mu.Unlock() }
func (w *Worker) cleanup(ctx context.Context) {
	err := w.Store.Cleanup(ctx)
	w.mu.Lock()
	defer w.mu.Unlock()
	w.storageWarning = ""
	if err != nil {
		w.storageWarning = "evidence retention/reconciliation failed; retrying"
	}
}

// reconcile discovers enable/delete changes independently of inference latency.
func (w *Worker) reconcile(ctx context.Context) {
	query, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var enabled []models.Camera
	err := w.DB.WithContext(query).Where("ai_enabled = ?", true).Find(&enabled).Error
	w.mu.Lock()
	defer w.mu.Unlock()
	if err != nil {
		w.discoveryWarning = "camera discovery database unavailable"
		w.cameras = nil
		return
	}
	w.discoveryWarning = ""
	w.cameras = nil
	alive := map[uint]bool{}
	for _, c := range enabled {
		alive[c.ID] = true
		if c.SourceType != "browser" {
			w.cameras = append(w.cameras, c)
		}
	}
	if w.activeID != 0 && !alive[w.activeID] && w.cancel != nil {
		w.cancel()
	}
	for id := range w.statuses {
		if !alive[id] {
			delete(w.statuses, id)
		}
	}
}
func (w *Worker) Run(ctx context.Context) {
	w.reconcile(ctx)
	maintenanceDone := make(chan struct{})
	retentionDone := make(chan struct{})
	go func() {
		defer close(maintenanceDone)
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				w.reconcile(ctx)
			}
		}
	}()
	go func() {
		defer close(retentionDone)
		for {
			clean, cancel := context.WithTimeout(ctx, 30*time.Second)
			w.cleanup(clean)
			cancel()
			delay := time.Hour
			warning, _ := w.Warnings()
			if warning != "" {
				delay = time.Minute
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
			}
		}
	}()
	defer func() { <-maintenanceDone; <-retentionDone }()
	if !w.Config.DetectionEnabled {
		<-ctx.Done()
		return
	}
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		w.mu.Lock()
		cams := append([]models.Camera(nil), w.cameras...)
		w.mu.Unlock()
		sort.Slice(cams, func(i, j int) bool {
			a, b := w.Status(cams[i]), w.Status(cams[j])
			if a.NextDue.Equal(b.NextDue) {
				return cams[i].ID < cams[j].ID
			}
			return a.NextDue.Before(b.NextDue)
		})
		if len(cams) == 0 {
			continue
		}
		cam := cams[0]
		s := w.Status(cam)
		if time.Now().Before(s.NextDue) {
			continue
		}
		job, cancel := context.WithCancel(ctx)
		w.mu.Lock()
		w.activeID = cam.ID
		w.cancel = cancel
		w.mu.Unlock()
		w.process(job, cam, s)
		cancel()
		w.mu.Lock()
		w.activeID = 0
		w.cancel = nil
		w.mu.Unlock()
	}
}
func (w *Worker) process(ctx context.Context, cam models.Camera, s Status) {
	start := time.Now()
	s.CameraID = cam.ID
	s.State = "starting"
	s.Failure = ""
	defer func() {
		s.DurationMS = time.Since(start).Milliseconds()
		s.NextDue = start.Add(w.Config.DetectionInterval)
		if s.Failure != "" {
			s.NextDue = time.Now().Add(5 * time.Second)
		}
		if ctx.Err() == nil {
			w.update(s)
		}
	}()
	f, err := w.Snapshots.Get(ctx, cam.EntityID)
	if err != nil {
		s.State = "camera unavailable"
		s.Failure = err.Error()
		return
	}
	w.processFrame(ctx, cam, f, &s)
}

// ProcessBrowserFrame runs one authenticated browser upload through the same
// model and incident store used by Home Assistant cameras.
func (w *Worker) ProcessBrowserFrame(ctx context.Context, cam models.Camera, f cameras.Frame) (s Status) {
	start := time.Now()
	s = w.Status(cam)
	s.CameraID = cam.ID
	s.State = "starting"
	s.Failure = ""
	defer func() {
		s.DurationMS = time.Since(start).Milliseconds()
		s.NextDue = start.Add(w.Config.DetectionInterval)
		if s.Failure != "" {
			s.NextDue = time.Now().Add(5 * time.Second)
		}
		if ctx.Err() == nil {
			w.update(s)
		}
	}()
	w.processFrame(ctx, cam, f, &s)
	return
}

func (w *Worker) processFrame(ctx context.Context, cam models.Camera, f cameras.Frame, s *Status) {
	s.LastImage = &f.ReceivedAt
	if s.LastSampleID == f.SampleID {
		s.State = "monitoring"
		return
	}
	w.inferenceMu.Lock()
	result, err := w.Model.Detect(ctx, f, math.Min(w.Config.FireThreshold, w.Config.SmokeThreshold))
	w.inferenceMu.Unlock()
	if err != nil {
		s.State = "model unavailable"
		s.Failure = err.Error()
		return
	}
	now := time.Now().UTC()
	s.LastInference = &now
	s.LastSampleID = f.SampleID
	s.State = "monitoring"
	if !result.Hazard {
		return
	}
	thresholds := map[string]float64{"fire": w.Config.FireThreshold, "smoke": w.Config.SmokeThreshold}
	for attempt := 0; attempt < 3; attempt++ {
		persist, cancel := context.WithTimeout(ctx, 5*time.Second)
		n, warning, e := w.Store.Save(persist, cam, f, result, thresholds)
		cancel()
		if n > 0 {
			saved := time.Now().UTC()
			s.LastPersistence = &saved
		}
		if errors.Is(e, incidents.ErrDisabled) || ctx.Err() != nil {
			return
		}
		if e == nil {
			if warning != "" {
				s.State = "storage error"
				s.Failure = warning
			}
			return
		}
		s.State = "storage error"
		s.Failure = "incident persistence failed"
		w.update(*s)
		if attempt < 2 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Duration(attempt+1) * time.Second):
			}
		}
	}
	s.LostResults++
}
