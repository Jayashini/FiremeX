package incidents

import (
	"bytes"
	"image"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestEvidenceBudgetAndContainment(t *testing.T) {
	var data bytes.Buffer
	jpeg.Encode(&data, image.NewRGBA(image.Rect(0, 0, 20, 20)), nil)
	e := &Evidence{Dir: t.TempDir(), MaxBytes: 1 << 20}
	name, err := e.Write(data.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = e.Read(name); err != nil {
		t.Fatal(err)
	}
	if _, err = e.Read("../outside.jpg"); err == nil {
		t.Fatal("traversal allowed")
	}
	outside := filepath.Join(t.TempDir(), "outside.jpg")
	os.WriteFile(outside, data.Bytes(), 0600)
	os.Symlink(outside, filepath.Join(e.Dir, "escape.jpg"))
	if _, err = e.Read("escape.jpg"); err == nil {
		t.Fatal("symlink escape allowed")
	}
	e.MaxBytes = 1
	if _, err = e.Write(data.Bytes()); err == nil {
		t.Fatal("budget ignored")
	}
	if err = e.Remove(name); err != nil {
		t.Fatal(err)
	}
}
