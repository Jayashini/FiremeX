export type Detection = { label: 'fire' | 'smoke'; confidence: number; box: { x1: number; y1: number; x2: number; y2: number } }
export type Incident = {
 id: number; reference: string; created_at: string; observed_at: string | null
 camera_id: number; camera_name: string; zone: string; class: 'fire' | 'smoke'; confidence: number
 review_status: string; status: string; detections: Detection[]; sample_id: string; model_version: string
 threshold_used: number | null; evidence_status: string; evidence_expires_at: string | null
 has_snapshot: boolean; snapshot_url: string | null
}
export type DetectorStatus = {
 camera_id: number; state: string; failure?: string; last_image_receipt: string | null
 last_inference_completion: string | null; last_persistence_success: string | null
 duration_ms: number; lost_results: number
}
