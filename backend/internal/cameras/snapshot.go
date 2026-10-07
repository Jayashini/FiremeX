// Package cameras shares bounded, cancellation-aware snapshots between viewers and monitoring.
package cameras

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const MaxBytes = 10 << 20
const MaxPixels = 20_000_000

type Frame struct {
	Data          []byte
	ContentType   string
	ReceivedAt    time.Time
	SampleID      string
	Width, Height int
}
type entry struct {
	frame Frame
	err   error
	at    time.Time
}
type Service struct {
	URL, Token string
	TTL        time.Duration
	Client     *http.Client
	mu         sync.Mutex
	cache      map[string]entry
	busy       map[string]chan struct{}
}

func New(base, token string, ttl time.Duration) *Service {
	return &Service{URL: strings.TrimRight(base, "/"), Token: token, TTL: ttl, Client: &http.Client{Timeout: 10 * time.Second}, cache: map[string]entry{}, busy: map[string]chan struct{}{}}
}

// Validate checks dimensions before decoding, then decodes fully to reject truncated images.
func Validate(data []byte) (int, int, string, error) {
	if len(data) == 0 || len(data) > MaxBytes {
		return 0, 0, "", fmt.Errorf("image size outside allowed bounds")
	}
	cfg, kind, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > MaxPixels {
		return 0, 0, "", fmt.Errorf("invalid image or excessive dimensions")
	}
	if _, _, err = image.Decode(bytes.NewReader(data)); err != nil {
		return 0, 0, "", fmt.Errorf("incomplete image")
	}
	return cfg.Width, cfg.Height, "image/" + kind, nil
}

// NewFrame validates untrusted image bytes and assigns a unique sample ID.
// It is shared by Home Assistant snapshots and browser webcam uploads.
func NewFrame(data []byte) (Frame, error) {
	w, h, kind, err := Validate(data)
	if err != nil {
		return Frame{}, err
	}
	id := make([]byte, 16)
	if _, err = rand.Read(id); err != nil {
		return Frame{}, err
	}
	return Frame{Data: data, ContentType: kind, ReceivedAt: time.Now().UTC(), SampleID: hex.EncodeToString(id), Width: w, Height: h}, nil
}
func (s *Service) Get(ctx context.Context, entity string) (Frame, error) {
	for {
		if err := ctx.Err(); err != nil {
			return Frame{}, err
		}
		s.mu.Lock()
		if e, ok := s.cache[entity]; ok && time.Since(e.at) < s.TTL {
			s.mu.Unlock()
			return e.frame, e.err
		}
		if done, ok := s.busy[entity]; ok {
			s.mu.Unlock()
			select {
			case <-done:
				continue
			case <-ctx.Done():
				return Frame{}, ctx.Err()
			}
		}
		done := make(chan struct{})
		s.busy[entity] = done
		s.mu.Unlock()
		f, err := s.fetch(ctx, entity)
		s.mu.Lock()
		// Cancelled callers must not poison the shared cache.
		if ctx.Err() == nil {
			s.cache[entity] = entry{f, err, time.Now()}
		}
		for k, e := range s.cache {
			if time.Since(e.at) > 30*time.Second {
				delete(s.cache, k)
			}
		}
		delete(s.busy, entity)
		close(done)
		s.mu.Unlock()
		return f, err
	}
}
func (s *Service) fetch(ctx context.Context, entity string) (Frame, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", s.URL+"/api/camera_proxy/"+url.PathEscape(entity), nil)
	if err != nil {
		return Frame{}, fmt.Errorf("invalid camera service URL")
	}
	req.Header.Set("Authorization", "Bearer "+s.Token)
	resp, err := s.Client.Do(req)
	if err != nil {
		return Frame{}, fmt.Errorf("camera request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return Frame{}, fmt.Errorf("camera returned HTTP %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, MaxBytes+1))
	if err != nil {
		return Frame{}, fmt.Errorf("camera image read failed")
	}
	return NewFrame(b)
}
