package cameras

import (
	"bytes"
	"context"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestSharedReceiptAndCancellation(t *testing.T) {
	var b bytes.Buffer
	jpeg.Encode(&b, image.NewRGBA(image.Rect(0, 0, 20, 20)), nil)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		time.Sleep(30 * time.Millisecond)
		w.Write(b.Bytes())
	}))
	defer upstream.Close()
	service := New(upstream.URL, "secret", time.Second)
	var wg sync.WaitGroup
	frames := make([]Frame, 8)
	for i := range frames {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			f, err := service.Get(context.Background(), "camera.test")
			if err != nil {
				t.Error(err)
			}
			frames[i] = f
		}(i)
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatalf("upstream fetches %d", calls.Load())
	}
	for _, f := range frames {
		if f.SampleID == "" || f.SampleID != frames[0].SampleID || !f.ReceivedAt.Equal(frames[0].ReceivedAt) {
			t.Fatal("cached receipt changed")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := service.Get(ctx, "camera.test"); err == nil {
		t.Fatal("cancelled request succeeded")
	}
}
func TestInvalidImages(t *testing.T) {
	var b bytes.Buffer
	jpeg.Encode(&b, image.NewRGBA(image.Rect(0, 0, 20, 20)), nil)
	for _, data := range [][]byte{nil, []byte("<html>error</html>"), b.Bytes()[:50], make([]byte, MaxBytes+1)} {
		if _, _, _, err := Validate(data); err == nil {
			t.Fatal("invalid image accepted")
		}
	}
}
func TestCancelledWaiter(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-release; w.WriteHeader(503) }))
	defer srv.Close()
	s := New(srv.URL, "", time.Second)
	done := make(chan struct{})
	go func() { defer close(done); s.Get(context.Background(), "a") }()
	<-started
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if _, err := s.Get(ctx, "a"); err == nil {
		t.Fatal("wait did not cancel")
	}
	close(release)
	<-done
}
