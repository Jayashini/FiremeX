package inference

import (
	"context"
	"github.com/firemex/backend/internal/cameras"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestContract(t *testing.T) {
	tests := []struct {
		name, body string
		valid      bool
	}{
		{"negative", `{"hazard":false,"detections":[],"model_version":"test"}`, true},
		{"positive", `{"hazard":true,"detections":[{"label":"fire","confidence":0.8,"box":{"x1":0,"y1":0,"x2":5,"y2":5}}],"model_version":"test"}`, true},
		{"missing", `{}`, false},
		{"inconsistent", `{"hazard":true,"detections":[],"model_version":"test"}`, false},
		{"label", `{"hazard":true,"detections":[{"label":"person","confidence":0.8,"box":{"x1":0,"y1":0,"x2":5,"y2":5}}],"model_version":"test"}`, false},
		{"score", `{"hazard":true,"detections":[{"label":"fire","confidence":1.8,"box":{"x1":0,"y1":0,"x2":5,"y2":5}}],"model_version":"test"}`, false},
		{"bounds", `{"hazard":true,"detections":[{"label":"fire","confidence":0.8,"box":{"x1":0,"y1":0,"x2":500,"y2":5}}],"model_version":"test"}`, false},
		{"missing coordinate", `{"hazard":true,"detections":[{"label":"fire","confidence":0.8,"box":{"y1":0,"x2":5,"y2":5}}],"model_version":"test"}`, false},
		{"annotation", `{"hazard":false,"detections":[],"model_version":"test","annotated_image":"garbage"}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if err := r.ParseMultipartForm(1 << 20); err != nil {
					t.Error(err)
				}
				if r.FormValue("threshold") != "0.5" || r.FormValue("annotate") != "true" {
					t.Error("missing settings")
				}
				w.Write([]byte(tt.body))
			}))
			defer srv.Close()
			_, err := New(srv.URL, time.Second).Detect(context.Background(), cameras.Frame{Data: []byte("sample"), Width: 20, Height: 20}, 0.5)
			if (err == nil) != tt.valid {
				t.Fatalf("valid=%v err=%v", tt.valid, err)
			}
		})
	}
}
func TestTimeout(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { time.Sleep(100 * time.Millisecond) }))
	defer s.Close()
	_, err := New(s.URL, 10*time.Millisecond).Detect(context.Background(), cameras.Frame{}, 0.5)
	if err == nil {
		t.Fatal("timeout not enforced")
	}
}
