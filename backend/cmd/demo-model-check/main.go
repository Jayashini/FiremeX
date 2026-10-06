// demo-model-check exercises the production Go client against a real model server.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/internal/inference"
	"os"
	"time"
)

func main() {
	path := flag.String("image", "", "JPEG/PNG frame")
	url := flag.String("url", "http://127.0.0.1:8100", "model URL")
	cutoff := flag.Float64("threshold", .5, "confidence cutoff")
	flag.Parse()
	raw, err := os.ReadFile(*path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "image unavailable")
		os.Exit(1)
	}
	w, h, kind, err := cameras.Validate(raw)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	start := time.Now()
	result, err := inference.New(*url, 30*time.Second).Detect(context.Background(), cameras.Frame{Data: raw, ContentType: kind, Width: w, Height: h, ReceivedAt: start}, *cutoff)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	annotated := result.AnnotatedImage != ""
	result.AnnotatedImage = ""
	json.NewEncoder(os.Stdout).Encode(map[string]any{"seconds": time.Since(start).Seconds(), "annotation_validated": annotated, "result": result})
}
