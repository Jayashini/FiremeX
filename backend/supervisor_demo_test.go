package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/firemex/backend/config"
	"github.com/firemex/backend/controllers"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/internal/detection"
	"github.com/firemex/backend/internal/incidents"
	"github.com/firemex/backend/internal/inference"
	"github.com/firemex/backend/middleware"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Uses a disposable schema, never truncates or modifies existing application data.
func demoDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("FIREMEX_TEST_DSN")
	if dsn == "" {
		t.Skip("set FIREMEX_TEST_DSN for isolated PostgreSQL integration tests")
	}
	base, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("demo_test_%d", time.Now().UnixNano())
	if err = base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		sql, _ := db.DB()
		sql.Close()
		base.Exec("DROP SCHEMA " + schema + " CASCADE")
		sql, _ = base.DB()
		sql.Close()
	})
	if err = db.AutoMigrate(&models.Organization{}, &models.User{}, &models.Camera{}, &models.Incident{}); err != nil {
		t.Fatal(err)
	}
	return db
}
func TestSupervisorPipeline(t *testing.T) {
	db := demoDB(t)
	database.DB = db
	gin.SetMode(gin.TestMode)
	org := models.Organization{Name: "Disposable demo", Code: "DEMO", Sector: "test", Email: "test@example.invalid"}
	if err := db.Create(&org).Error; err != nil {
		t.Fatal(err)
	}
	other := models.Organization{Name: "Other", Code: "OTHER", Sector: "test", Email: "other@example.invalid"}
	db.Create(&other)
	admin := models.User{Name: "Test", Email: "admin@example.invalid", Password: "unused", Role: "admin", Status: "active", OrganizationID: &org.ID}
	db.Create(&admin)
	operator := models.User{Name: "Operator", Email: "operator@example.invalid", Password: "unused", Role: "operator", Status: "active", OrganizationID: &org.ID}
	db.Create(&operator)
	outsider := models.User{Name: "Other", Email: "outsider@example.invalid", Password: "unused", Role: "admin", Status: "active", OrganizationID: &other.ID}
	db.Create(&outsider)
	cam := models.Camera{EntityID: "camera.test", DisplayName: "Recorded replay – test only", Zone: "Demo", AiEnabled: true, OrganizationID: org.ID}
	db.Create(&cam)
	var img bytes.Buffer
	jpeg.Encode(&img, image.NewRGBA(image.Rect(0, 0, 32, 32)), nil)
	ha := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		w.Write(img.Bytes())
	}))
	defer ha.Close()
	model := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(inference.Result{Hazard: true, ModelVersion: "stub-contract-only", Detections: []inference.Detection{{Label: "fire", Confidence: .8, Box: inference.Box{X1: 1, Y1: 1, X2: 20, Y2: 20}}, {Label: "smoke", Confidence: .7, Box: inference.Box{X1: 1, Y1: 1, X2: 25, Y2: 25}}}})
	}))
	defer model.Close()
	now := time.Now().UTC()
	store := &incidents.Store{DB: db, Evidence: &incidents.Evidence{Dir: t.TempDir(), MaxBytes: 1 << 20}, Cooldown: time.Minute, Retention: 7 * 24 * time.Hour, Now: func() time.Time { return now }}
	snap := cameras.New(ha.URL, "", time.Millisecond)
	cfg := config.Config{DetectionEnabled: true, DetectionInterval: 50 * time.Millisecond, FireThreshold: .5, SmokeThreshold: .5, ModelTimeout: time.Second}
	worker := detection.New(db, snap, inference.New(model.URL, time.Second), store, cfg)
	controllers.Snapshots = snap
	controllers.Detector = worker
	controllers.IncidentStore = store
	config.C.JWTSecret = []byte("test-only-never-used-for-real-accounts")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); worker.Run(ctx) }()
	deadline := time.Now().Add(5 * time.Second)
	var count int64
	for time.Now().Before(deadline) {
		db.Model(&models.Incident{}).Count(&count)
		if count == 2 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-done
	if count != 2 {
		t.Fatalf("expected fire and smoke persisted by background worker, got %d", count)
	}
	var rows []models.Incident
	db.Order("id").Find(&rows)
	if rows[0].ReviewStatus != "unconfirmed" || rows[0].ModelVersion != "stub-contract-only" || rows[0].SnapshotFile == "" {
		t.Fatal("trace/evidence missing")
	}
	// Reconstruct Store to prove suppression comes from PostgreSQL, not memory.
	restart := &incidents.Store{DB: db, Evidence: store.Evidence, Cooldown: store.Cooldown, Retention: store.Retention, Now: store.Now}
	f := cameras.Frame{Data: img.Bytes(), ReceivedAt: now, SampleID: rows[0].SampleID, Width: 32, Height: 32}
	result := inference.Result{Hazard: true, ModelVersion: "stub-contract-only", Detections: []inference.Detection{{Label: "fire", Confidence: .8, Box: inference.Box{X1: 1, Y1: 1, X2: 20, Y2: 20}}}}
	thresholds := map[string]float64{"fire": .5, "smoke": .5}
	if n, _, err := restart.Save(context.Background(), cam, f, result, thresholds); err != nil || n != 0 {
		t.Fatalf("retry duplicated: %d %v", n, err)
	}
	now = now.Add(2 * time.Minute)
	if n, _, err := restart.Save(context.Background(), cam, f, result, thresholds); err != nil || n != 0 {
		t.Fatalf("idempotency after cooldown failed: %d %v", n, err)
	}
	f.SampleID = "later"
	if n, _, err := restart.Save(context.Background(), cam, f, result, thresholds); err != nil || n != 1 {
		t.Fatalf("new window failed: %d %v", n, err)
	}
	router := gin.New()
	api := router.Group("/api", middleware.RequireAuth)
	api.GET("/incidents", controllers.GetIncidents)
	api.GET("/incidents/:id", controllers.GetIncident)
	api.GET("/incidents/:id/snapshot", controllers.IncidentSnapshot)
	api.GET("/detection/status", controllers.DetectionStatus)
	api.PATCH("/cameras/:id/detection", middleware.RequireAdmin, controllers.ToggleDetection)
	request := func(user models.User, method, path, body string, cookie bool) *httptest.ResponseRecorder {
		token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": user.ID, "exp": time.Now().Add(time.Hour).Unix()}).SignedString(config.C.JWTSecret)
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if cookie {
			req.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: token})
		} else {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr
	}
	path := fmt.Sprintf("/api/incidents/%d", rows[0].ID)
	checks := []struct {
		user               models.User
		method, path, body string
		code               int
		cookie             bool
	}{
		{admin, "GET", "/api/incidents?page_size=1", "", 200, false},
		{operator, "GET", path, "", 200, false},
		{admin, "GET", path + "/snapshot", "", 200, true},
		{outsider, "GET", path, "", 404, false},
		{outsider, "GET", path + "/snapshot", "", 404, true},
		{admin, "GET", "/api/incidents/1%20OR%201=1", "", 400, false},
		{admin, "GET", "/api/incidents?page_size=101", "", 400, false},
		{admin, "GET", "/api/incidents?page=0", "", 400, false},
		{admin, "GET", "/api/incidents?class=person", "", 400, false},
		{operator, "PATCH", fmt.Sprintf("/api/cameras/%d/detection", cam.ID), `{"ai_enabled":false}`, 403, false},
		{outsider, "PATCH", fmt.Sprintf("/api/cameras/%d/detection", cam.ID), `{"ai_enabled":false}`, 404, false},
		{admin, "PATCH", fmt.Sprintf("/api/cameras/%d/detection", cam.ID), `{}`, 400, false},
	}
	for _, check := range checks {
		rr := request(check.user, check.method, check.path, check.body, check.cookie)
		if rr.Code != check.code {
			t.Errorf("%s %s got %d want %d: %s", check.method, check.path, rr.Code, check.code, rr.Body.String())
		}
	}
	rr := request(admin, "GET", "/api/incidents?page_size=1", "", false)
	var listing struct {
		Incidents []map[string]any `json:"incidents"`
		Total     int              `json:"total"`
	}
	json.Unmarshal(rr.Body.Bytes(), &listing)
	if listing.Total != 3 || len(listing.Incidents) != 1 {
		t.Fatal("pagination incorrect")
	}
	if _, ok := listing.Incidents[0]["detections"].([]any); !ok {
		t.Fatal("detections are not an array")
	}
	if _, ok := listing.Incidents[0]["snapshot_file"]; ok {
		t.Fatal("disk path leaked")
	}
	rr = request(outsider, "GET", "/api/incidents", "", false)
	if !strings.Contains(rr.Body.String(), `"incidents":[]`) {
		t.Fatal("empty org leaked records")
	}
	db.Model(&operator).Update("status", "revoked")
	if rr = request(operator, "GET", path+"/snapshot", "", true); rr.Code != 403 {
		t.Fatal("revoked image access")
	}
	db.Model(&outsider).Update("organization_id", nil)
	if rr = request(outsider, "GET", "/api/incidents", "", false); rr.Code != 403 {
		t.Fatal("organization-less access")
	}
	if rr = request(admin, "PATCH", fmt.Sprintf("/api/cameras/%d/detection", cam.ID), `{"ai_enabled":false}`, false); rr.Code != 200 {
		t.Fatal(rr.Body.String())
	}
	f.SampleID = "disabled"
	if _, _, err := store.Save(context.Background(), cam, f, result, thresholds); err != incidents.ErrDisabled {
		t.Fatal("disabled camera saved")
	}
	db.Model(&cam).Update("ai_enabled", true)
	now = now.Add(2 * time.Minute)
	f.SampleID = "disk-full"
	store.Evidence.MaxBytes = 1
	if n, warning, err := store.Save(context.Background(), cam, f, result, thresholds); n != 1 || warning == "" || err != nil {
		t.Fatalf("metadata fallback failed: %d %q %v", n, warning, err)
	}
	var missing models.Incident
	db.Where("sample_id = ?", f.SampleID).First(&missing)
	if missing.EvidenceStatus != "missing" || missing.SnapshotFile != "" {
		t.Fatal("missing evidence mislabeled")
	}
	// Expiry is enforced by the endpoint before cleanup has run.
	past := time.Now().Add(-time.Hour)
	db.Model(&rows[0]).Update("evidence_expires_at", past)
	if rr = request(admin, "GET", path+"/snapshot", "", false); rr.Code != 410 {
		t.Fatal("expired evidence served")
	}
	now = now.Add(8 * 24 * time.Hour)
	if err := store.Cleanup(context.Background()); err != nil {
		t.Fatal(err)
	}
	db.First(&rows[0], rows[0].ID)
	if rows[0].EvidenceStatus != "expired" || rows[0].SnapshotFile != "" {
		t.Fatal("cleanup did not retain metadata and clear path")
	}
	if err := db.AutoMigrate(&models.Incident{}); err != nil {
		t.Fatalf("repeat migration: %v", err)
	}
}

func TestWorkerFairnessAndRecovery(t *testing.T) {
	db := demoDB(t)
	org := models.Organization{Name: "Scheduler test", Code: "SCHED", Sector: "test", Email: "sched@example.invalid"}
	db.Create(&org)
	var cams []models.Camera
	for i := 0; i < 4; i++ {
		cam := models.Camera{EntityID: fmt.Sprintf("camera.%d", i), DisplayName: fmt.Sprintf("Replay %d", i), AiEnabled: true, OrganizationID: org.ID}
		db.Create(&cam)
		cams = append(cams, cam)
	}
	var img bytes.Buffer
	jpeg.Encode(&img, image.NewRGBA(image.Rect(0, 0, 32, 32)), nil)
	var cameraFailed atomic.Bool
	cameraFailed.Store(true)
	var modelFailed atomic.Bool
	modelFailed.Store(true)
	var active, maxActive atomic.Int32
	ha := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "camera.0") && cameraFailed.Load() {
			w.WriteHeader(503)
			return
		}
		w.Write(img.Bytes())
	}))
	defer ha.Close()
	ml := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := active.Add(1)
		defer active.Add(-1)
		if n > maxActive.Load() {
			maxActive.Store(n)
		}
		time.Sleep(10 * time.Millisecond)
		if modelFailed.Load() {
			w.WriteHeader(503)
			return
		}
		w.Write([]byte(`{"hazard":false,"detections":[],"model_version":"stub"}`))
	}))
	defer ml.Close()
	store := &incidents.Store{DB: db, Evidence: &incidents.Evidence{Dir: t.TempDir(), MaxBytes: 1 << 20}, Cooldown: time.Minute, Retention: time.Hour}
	worker := detection.New(db, cameras.New(ha.URL, "", time.Millisecond), inference.New(ml.URL, time.Second), store, config.Config{DetectionEnabled: true, DetectionInterval: 20 * time.Millisecond, FireThreshold: .5, SmokeThreshold: .5})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); worker.Run(ctx) }()
	defer func() { cancel(); <-done }()
	await := func(check func() bool) {
		t.Helper()
		deadline := time.Now().Add(9 * time.Second)
		for time.Now().Before(deadline) {
			if check() {
				return
			}
			time.Sleep(20 * time.Millisecond)
		}
		t.Fatal("worker state deadline exceeded")
	}
	await(func() bool {
		return worker.Status(cams[0]).State == "camera unavailable" && worker.Status(cams[3]).State == "model unavailable"
	})
	cameraFailed.Store(false)
	modelFailed.Store(false)
	await(func() bool {
		for _, cam := range cams {
			if worker.Status(cam).LastInference == nil {
				return false
			}
		}
		return true
	})
	if maxActive.Load() != 1 {
		t.Fatalf("inference concurrency %d", maxActive.Load())
	}
	db.Model(&cams[0]).Update("ai_enabled", false)
	cams[0].AiEnabled = false
	await(func() bool { return worker.Status(cams[0]).State == "monitoring disabled" })
}
