# CampusFlow

## Platform
web

## Purpose and users
A Traditional Chinese graduation-project workspace for student teams and supervising teachers. Preserve all existing functionality while improving utility and presentation. Primary daily use by student teams is an assumption pending user feedback.

## Existing product truth
React 19, Vite, Tailwind and Firebase Auth/Firestore. Google authentication; leader creates a group, member joins by code, teacher approval and group switching. Tasks support types, assignment, importance, start/deadline/completion dates, details, status transitions and deletion. Calendar, graduation-project Gantt ordering/colors/zoom, progress, weekly MVP, points/late penalties, name changes, issue reports and Discord integration exist.

## Constraints
Preserve Firestore schema, access rules, teacher approval, original functions and Discord worker. No file deletion without the user's consent. Do not publish or write sample data into the live backend as part of preview. Use explicit sample labeling for demo data. Keep Traditional Chinese and responsive keyboard-accessible UI.

## Confirmed direction
The user selected Project Studio: navy navigation and a light workspace. Preserve existing student and teacher workflows. Use direct Traditional Chinese field labels and remove slogans. Avoid green in all new design unless the user explicitly allows it; existing saved Gantt colors must not be silently rewritten.

The Gantt uses precise timestamps with adjustable scales and a presentation mode, plus full-result PNG/SVG export. It represents stored task dates rather than a separate planned-versus-actual schedule.

Implementation and verification status: [HANDOFF.md](../HANDOFF.md). There are no pending visual-direction questions; follow the next user request rather than restarting discovery.
