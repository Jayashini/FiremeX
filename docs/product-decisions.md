# FireMeX product decisions and project memory

Recorded 6 October 2026 from the project owner's answers. Read this alongside the future action plan before planning or implementing work. This is persistent project context; it does not mean the decisions have been implemented.

## Confirmed direction

| Topic | User decision |
|---|---|
| Initial customers | Factories and warehouses. |
| Ownership | One organization per local installation; an administrator manages cameras/users and approves operators. |
| Current equipment | MacBook with Apple M2; using its camera. RAM, Home Assistant runtime/version and measured inference speed are not yet confirmed. |
| Future cameras | Intends to buy an “eviz compatible” CCTV camera. Exact brand spelling, model, local protocols and Home Assistant compatibility remain unverified; do not assume all cameras from a brand work. |
| Camera count | Do not hard-code a fixed camera count. Approximately four cameras for testing. This is not a promise of unlimited hardware capacity. |
| Detection events | Create alerts/incidents when fire or smoke is detected; do not wait for human confirmation to record the machine report. |
| Evidence | Detection images, retained for seven days. Video recording is not requested. |
| Team roles | User mainly owns backend development; another team member owns ML. Coordinate model behavior, sample footage and provenance with that teammate. |
| Immediate priority | Before the wider product roadmap, demonstrate computer camera/video source → existing ML model → persistent incident in the real incident table to the supervisor. User currently requests a detailed implementation plan, not implementation. |

## User preferences requiring further definition

- Physical sirens: user wants activation when confidence goes **above 50%**. Preserve this requested direction; it conflicts with the original roadmap's exclusion of physical automation. Exact hardware, whether fire and smoke both trigger, repeated-frame confirmation, reset/latching and authorized test setup remain undecided. This is separate from the immediate camera-to-incident demo. Do not silently turn this into an approved production policy or replace it with a different threshold.
- Detection delay: **within 30 seconds**, explicitly tentative.
- False alerts: **five per day**, explicitly tentative. Proposed interpretation is five across the entire test site, not five per camera; this interpretation is not yet confirmed.
- ML model/data origins and commercial permissions: user does not own this workstream; obtain the handoff from the ML teammate. Repository model documentation is existing information, not a fresh verification from that teammate.

## Recommendations, not user approvals

1. For the supervisor demo, target incident visibility within 10 seconds under normal one-camera conditions, with a provisional 30-second maximum in the agreed test cases. Measure actual delays and misses; do not claim guaranteed real-world detection.
2. Use five false alerts/site/day only as an initial development observation ceiling. Discuss a stricter pilot target, initially one/site/day or less, with the team and operators; do not sacrifice fire/smoke recall merely to meet a count. Log monitored camera-hours alongside counts.
3. Use configurable per-class detection thresholds, initially 0.50 for integration testing, with ML teammate review. This demo threshold is distinct from the user's future strictly-greater-than-0.50 siren preference.
4. Demonstrate visible in-app warnings and saved evidence first. If a siren demonstration is later wanted, define a separate supervised, explicitly armed test step. Model confidence alone is not validated incident probability.
5. Delete detection image files after seven days. Keep incident metadata for the demo and show “Evidence expired”; long-term incident-record retention is still to be decided.

## Working documents

- [Supervisor demo implementation plan](../FIREMEX_SUPERVISOR_DEMO_PLAN.md)
- [Full product roadmap](../FIREMEX_FUTURE_ACTION_PLAN.md)
- [Repository audit](../FIREMEX_CURRENT_STATE_ANALYSIS.md)

Update this file when the user revises a decision. Keep confirmed choices separate from recommendations and unresolved questions.
