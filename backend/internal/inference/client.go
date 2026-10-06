package inference

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/firemex/backend/internal/cameras"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Box struct {
	X1 float64 `json:"x1"`
	Y1 float64 `json:"y1"`
	X2 float64 `json:"x2"`
	Y2 float64 `json:"y2"`
}
type Detection struct {
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
	Box        Box     `json:"box"`
}
type Result struct {
	Hazard         bool        `json:"hazard"`
	Detections     []Detection `json:"detections"`
	AnnotatedImage string      `json:"annotated_image,omitempty"`
	ModelVersion   string      `json:"model_version"`
}
type Client struct {
	URL  string
	HTTP *http.Client
}

func New(url string, timeout time.Duration) *Client {
	return &Client{strings.TrimRight(url, "/"), &http.Client{Timeout: timeout}}
}
func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func (c *Client) Detect(ctx context.Context, f cameras.Frame, threshold float64) (Result, error) {
	var result Result
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("image", "sample.jpg")
	if err != nil {
		return result, err
	}
	part.Write(f.Data)
	mw.WriteField("annotate", "true")
	mw.WriteField("threshold", strconv.FormatFloat(threshold, 'f', -1, 64))
	mw.Close()
	req, err := http.NewRequestWithContext(ctx, "POST", c.URL+"/detect", &body)
	if err != nil {
		return result, fmt.Errorf("invalid model URL")
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return result, fmt.Errorf("model request failed or timed out")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return result, fmt.Errorf("model returned HTTP %d", resp.StatusCode)
	}
	const maxResponse = 16 << 20
	b, err := io.ReadAll(io.LimitReader(resp.Body, maxResponse+1))
	if err != nil || len(b) > maxResponse {
		return result, fmt.Errorf("model response exceeds bounds or could not be read")
	}
	// Pointer fields distinguish a malformed response from a valid negative result.
	var wire struct {
		Hazard         *bool        `json:"hazard"`
		Detections     *[]Detection `json:"detections"`
		AnnotatedImage string       `json:"annotated_image"`
		ModelVersion   string       `json:"model_version"`
	}
	if err = json.Unmarshal(b, &wire); err != nil || wire.Hazard == nil || wire.Detections == nil || wire.ModelVersion == "" {
		return result, fmt.Errorf("invalid model response contract")
	}
	// Require all detection fields; omitted numeric coordinates must not silently become zero.
	var shape struct {
		Detections []map[string]json.RawMessage `json:"detections"`
	}
	if err := json.Unmarshal(b, &shape); err != nil {
		return result, fmt.Errorf("invalid detection shape")
	}
	for _, d := range shape.Detections {
		for _, key := range []string{"label", "confidence", "box"} {
			if len(d[key]) == 0 || string(d[key]) == "null" {
				return result, fmt.Errorf("missing detection field")
			}
		}
		var box map[string]json.RawMessage
		if json.Unmarshal(d["box"], &box) != nil {
			return result, fmt.Errorf("invalid box")
		}
		for _, key := range []string{"x1", "y1", "x2", "y2"} {
			if len(box[key]) == 0 || string(box[key]) == "null" {
				return result, fmt.Errorf("missing box coordinate")
			}
		}
	}
	result = Result{*wire.Hazard, *wire.Detections, wire.AnnotatedImage, wire.ModelVersion}
	if len(result.Detections) > 1000 || result.Hazard != (len(result.Detections) > 0) {
		return Result{}, fmt.Errorf("inconsistent model hazard")
	}
	for _, d := range result.Detections {
		b := d.Box
		if (d.Label != "fire" && d.Label != "smoke") || !finite(d.Confidence) || d.Confidence < threshold || d.Confidence > 1 || !finite(b.X1) || !finite(b.X2) || !finite(b.Y1) || !finite(b.Y2) || b.X1 < 0 || b.Y1 < 0 || b.X2 <= b.X1 || b.Y2 <= b.Y1 || b.X2 > float64(f.Width) || b.Y2 > float64(f.Height) {
			return Result{}, fmt.Errorf("invalid model detection")
		}
	}
	if result.AnnotatedImage != "" {
		raw, e := base64.StdEncoding.DecodeString(result.AnnotatedImage)
		if e != nil {
			return Result{}, fmt.Errorf("invalid annotated image")
		}
		w, h, kind, e := cameras.Validate(raw)
		if e != nil || kind != "image/jpeg" || w != f.Width || h != f.Height {
			return Result{}, fmt.Errorf("invalid annotated image dimensions or format")
		}
	}
	return result, nil
}
