package incidents

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"github.com/firemex/backend/internal/cameras"
	"image"
	"image/jpeg"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Evidence struct {
	Dir      string
	MaxBytes int64
	mu       sync.Mutex
}

func (e *Evidence) root() (*os.Root, error) {
	if err := os.MkdirAll(e.Dir, 0700); err != nil {
		return nil, err
	}
	return os.OpenRoot(e.Dir)
}
func validName(name string) bool {
	return name != "" && filepath.Base(name) == name && !strings.ContainsAny(name, "/\\") && strings.HasSuffix(name, ".jpg")
}
func (e *Evidence) Read(name string) ([]byte, error) {
	if !validName(name) {
		return nil, fmt.Errorf("invalid evidence name")
	}
	root, err := e.root()
	if err != nil {
		return nil, err
	}
	defer root.Close()
	f, err := root.Open(name)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, cameras.MaxBytes+1))
	if len(b) > cameras.MaxBytes {
		return nil, fmt.Errorf("evidence too large")
	}
	return b, err
}
func (e *Evidence) Remove(name string) error {
	if !validName(name) {
		return fmt.Errorf("invalid evidence name")
	}
	root, err := e.root()
	if err != nil {
		return err
	}
	defer root.Close()
	err = root.Remove(name)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
func (e *Evidence) Write(data []byte) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, _, _, err := cameras.Validate(data); err != nil {
		return "", err
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	var b bytes.Buffer
	if err = jpeg.Encode(&b, img, &jpeg.Options{Quality: 90}); err != nil {
		return "", err
	}
	if b.Len() > cameras.MaxBytes {
		return "", fmt.Errorf("encoded evidence too large")
	}
	root, err := e.root()
	if err != nil {
		return "", err
	}
	defer root.Close()
	entries, err := os.ReadDir(e.Dir)
	if err != nil {
		return "", err
	}
	var used int64
	for _, d := range entries {
		info, err := d.Info()
		if err != nil {
			return "", err
		}
		used += info.Size()
	}
	if used+int64(b.Len()) > e.MaxBytes {
		return "", fmt.Errorf("evidence disk budget reached")
	}
	id := make([]byte, 16)
	if _, err = rand.Read(id); err != nil {
		return "", err
	}
	name := hex.EncodeToString(id) + ".jpg"
	tmp := name + ".tmp"
	f, err := root.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	_, err = f.Write(b.Bytes())
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err == nil {
		err = root.Rename(tmp, name)
	}
	if err != nil {
		root.Remove(tmp)
		return "", err
	}
	return name, nil
}
