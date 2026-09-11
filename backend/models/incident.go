// Incident is the record of one hazard the AI reported.
//
// It is the heart of the detection phase. The detector worker samples a camera,
// shows the frame to the model, and when the model says "fire" it writes one of
// these rows. From that moment on the row is the product: operators read it,
// act on it, and close it.
//
// Two ideas shape every decision in this file.
//
//  1. An incident is HISTORY, not a live view. Once written it describes a
//     moment that has passed, so it must never change because something else
//     changed later - which is why the camera's name is copied in rather than
//     looked up.
//
//  2. An incident is EVIDENCE. There is deliberately no soft-delete column
//     here, unlike every other model in FiremeX. An audit log you can erase is
//     not an audit log.
package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// The two things the model can see. These are the exact strings the Python
// service returns, so no translation table is needed anywhere.
const (
	IncidentClassFire  = "fire"
	IncidentClassSmoke = "smoke"
)

// Where an incident is in its life.
//
// Stored as text rather than a number on purpose: adding a new state later
// (a "false_alarm" is the obvious candidate) costs one line, where renumbering
// an enum across a live database costs a migration and a careful evening.
const (
	IncidentStatusUnresolved = "unresolved"
	IncidentStatusInProgress = "in_progress"
	IncidentStatusResolved   = "resolved"
)

// Incident is one hazard report.
type Incident struct {
	// These four fields are exactly what gorm.Model would have given us. They
	// are written out by hand for one reason: CreatedAt needs index tags, and a
	// field inherited from an embedded struct cannot be tagged.
	//
	// Note what is missing - DeletedAt. Every other FiremeX model embeds
	// gorm.Model and therefore supports soft deletion. This one does not, so
	// that "delete an incident" is not an operation the code can even express.
	ID        uint      `json:"id" gorm:"primarykey"`
	CreatedAt time.Time `json:"created_at" gorm:"index:idx_incident_camera_time,priority:2,sort:desc;index:idx_incident_org_time,priority:2,sort:desc"`
	UpdatedAt time.Time `json:"updated_at"`

	// ---------------------------------------------------------------- who

	// OrganizationID is the multi-tenant fence, the same one every camera
	// query uses. Paired with CreatedAt in idx_incident_org_time, because
	// "this organisation's incidents, newest first" is the Incidents page.
	OrganizationID uint          `json:"organization_id" gorm:"not null;index:idx_incident_org_time,priority:1"`
	Organization   *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`

	// CameraID links to the live camera, for filtering and for the cooldown.
	// Paired with CreatedAt in idx_incident_camera_time, because the detector
	// asks "any incident on this camera in the last 2 minutes?" once every few
	// seconds for every camera. That question must stay fast forever.
	CameraID uint    `json:"camera_id" gorm:"not null;index:idx_incident_camera_time,priority:1"`
	Camera   *Camera `json:"camera,omitempty" gorm:"foreignKey:CameraID"`

	// CameraName and Zone are COPIES of the camera's labels as they were at the
	// moment of detection, not a join.
	//
	// If an admin renames "Cam 07" to "Loading Bay B" next month, a join would
	// silently make last month's incidents say "Loading Bay B" too - a room
	// nobody called that at the time. History is not allowed to rewrite itself,
	// so it is copied.
	CameraName string `json:"camera_name" gorm:"not null"`
	Zone       string `json:"zone"`

	// ---------------------------------------------------------------- what

	// Class is IncidentClassFire or IncidentClassSmoke - the most severe thing
	// in the frame. Fire outranks smoke.
	Class string `json:"class" gorm:"not null"`

	// Confidence is 0.0 to 1.0, kept exactly as the model reported it. The
	// model's own scale is stored and the percentage is a display decision, so
	// nothing is lost to rounding on the way in.
	Confidence float64 `json:"confidence" gorm:"not null"`

	// Detections is the model's full answer for that frame, as JSON text:
	// every box above the threshold, with its label, score and coordinates.
	//
	// Plain text rather than a JSON column type so that no extra library is
	// added for something that is only ever read back and displayed.
	Detections string `json:"detections" gorm:"type:text"`

	// SnapshotFile is the annotated frame on disk, relative to the snapshot
	// directory - for example "2026-09-11/inc_144208_cam7.jpg".
	//
	// Never sent to the browser: a disk path is the server's business, and the
	// browser gets the picture from /api/incidents/:id/snapshot instead.
	SnapshotFile string `json:"-"`

	// ---------------------------------------------------------------- what happened next

	// Status is one of the IncidentStatus constants. A new incident is always
	// "unresolved" - the machine's opinion, waiting for a human.
	Status string `json:"status" gorm:"not null;default:'unresolved'"`

	// ResolveNote is how the operator says it was dealt with.
	ResolveNote string `json:"resolve_note"`

	// BlockerReason is why it could NOT be dealt with. An incident with a
	// blocker stays unresolved on purpose - writing down why you are stuck is
	// not the same as being finished.
	BlockerReason string `json:"blocker_reason"`

	// Who closed it, and when. Pointers because both are empty until somebody
	// does - a zero time.Time would read as 1 January year 1, which is a lie.
	ResolvedByID *uint      `json:"resolved_by_id"`
	ResolvedBy   *User      `json:"resolved_by,omitempty" gorm:"foreignKey:ResolvedByID"`
	ResolvedAt   *time.Time `json:"resolved_at"`

	// ---------------------------------------------------------------- computed

	// Reference is the human-facing code, "INC-0042". HasSnapshot says whether
	// there is a picture to fetch.
	//
	// gorm:"-" means "this is not a database column". Both are filled in by the
	// hooks below every time a row is read, so the frontend never has to build
	// them and they can never drift between pages.
	Reference   string `json:"reference" gorm:"-"`
	HasSnapshot bool   `json:"has_snapshot" gorm:"-"`
}

// reference turns a row id into the code operators quote to each other.
//
// Derived from the primary key rather than stored in its own column: there is
// nothing to keep in sync, nothing to collide, and no counter to reset.
func reference(id uint) string {
	return fmt.Sprintf("INC-%04d", id)
}

// AfterFind runs automatically after GORM reads a row, so every incident that
// leaves the database already carries its reference and snapshot flag.
func (i *Incident) AfterFind(*gorm.DB) error {
	i.fillComputed()
	return nil
}

// AfterCreate does the same for a freshly inserted row, so the response to a
// create is shaped identically to the response to a read.
func (i *Incident) AfterCreate(*gorm.DB) error {
	i.fillComputed()
	return nil
}

func (i *Incident) fillComputed() {
	i.Reference = reference(i.ID)
	i.HasSnapshot = i.SnapshotFile != ""
}

// ValidIncidentStatus reports whether a status is one FiremeX recognises.
//
// Used by the update endpoint so that a typo, or somebody calling the API by
// hand, cannot park an incident in a state no screen knows how to display.
func ValidIncidentStatus(status string) bool {
	switch status {
	case IncidentStatusUnresolved, IncidentStatusInProgress, IncidentStatusResolved:
		return true
	default:
		return false
	}
}
