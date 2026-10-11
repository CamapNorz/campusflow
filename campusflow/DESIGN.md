---
name: CampusFlow
description: A calm graduation-project studio with navy navigation and a light working surface.
colors:
  ink: "#26344b"
  muted: "#657084"
  paper: "#f6f7f9"
  surface: "#ffffff"
  line: "#e4e8ee"
  blue: "#375ed3"
  blue-hover: "#284bb7"
  nav: "#192d49"
  nav-hover: "#263e5e"
  nav-active: "#35527b"
  danger: "#b63d48"
  report-label: "#53647e"
  report-ink: "#344760"
  report-detail: "#edf2fc"
  report-month: "#eef2f8"
  report-month-alternate: "#e3e9f3"
  report-order: "#f0f3f8"
typography:
  headline:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  title:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "13px"
  label:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "12px"
  report:
    fontFamily: "Microsoft JhengHei, Arial, sans-serif"
    fontSize: "12px"
  file-guidelines-heading:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "18px"
    lineHeight: 1.5
  file-guidelines-body:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "14px"
    lineHeight: 1.85
  file-guidelines-field:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "14px"
  file-guidelines-rule-title:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  file-guidelines-mobile-body:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "15px"
    lineHeight: 1.85
  file-guidelines-mobile-textarea:
    fontFamily: "DM Sans, Noto Sans TC, sans-serif"
    fontSize: "16px"
    lineHeight: 1.8
  file-guidelines-filename:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "13px"
rounded:
  ordering: "6px"
  field: "8px"
  navigation: "9px"
  task: "10px"
  board: "12px"
  panel: "14px"
spacing:
  compact: "8px"
  control: "12px"
  mobile: "16px"
  panel: "22px"
  section: "26px"
  desktop: "36px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  gantt-order-button:
    backgroundColor: "{colors.report-order}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.ordering}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "22px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.surface}"
    rounded: "{rounded.navigation}"
    padding: "10px 14px"
---

# Design System: CampusFlow

## Overview

**Creative North Star: "Project Studio / 專題工作室"**

The user confirmed this direction and authorized direct implementation. A steady navy navigation rail frames a light, practical workspace. Traditional Chinese copy makes the next action clear; restrained blue accents and readable progress information support everyday project coordination.

Key characteristics: quiet surfaces, clear task hierarchy, compact desktop information, and more generous mobile text. The built system is defined in `src/workspace.css`, `src/gantt.css`, `src/components/Overview.jsx`, `src/components/Icon.jsx`, `src/components/GanttChart.jsx`, `src/lib/gantt.js`, and `src/pages/Dashboard.jsx`. The Drive directory extension is scoped to `src/components/DriveDirectory.jsx`, `src/drive-directory.css`, and `src/lib/drive.js`.

Use functional headings such as 專題進度, 近期截止任務, and 成員任務統計. The user requested removal of slogans; keep copy descriptive and action-specific.

## Colors

### Primary

Blue identifies primary actions, links, and focus-related emphasis. Navy anchors navigation; its hover and active tones distinguish destinations without decorative effects.

### Neutral

Paper is the application canvas, white is the working surface, ink is primary text, muted is supporting text, and line separates adjacent information. The overview introduction uses a pale blue-gray tonal surface.

Status is also written in text: blue-gray for pending, amber for doing, purple for completed, and warm red for overdue or errors. Success feedback uses blue. Preserve user-selected Gantt colors; do not silently reinterpret saved values.

The Gantt report adds muted blue-gray label text, pale alternating month bands and a blue-tinted detail surface. Legacy report choices and saved data may still include green. This is an existing implementation discrepancy, not permission to use green in new design. The user's latest requirement prohibits green unless explicitly allowed; preserve saved values and handle the legacy palette deliberately in a future UI change.

**The Action Color Rule.** Use blue to clarify interaction and purple for completion; avoid green in all new design unless the user explicitly allows it. This requirement takes precedence over older wording in `.impeccable/design.json`.

## Typography

DM Sans handles Latin text and numbers; Noto Sans TC handles Traditional Chinese, with a sans-serif fallback. Both are imported from Google Fonts at weights 400–700. The interface must remain usable when remote fonts are unavailable.

The Gantt report alone uses Microsoft JhengHei, Arial, sans-serif intentionally, so its self-contained SVG and derived PNG do not depend on remote font loading. The surrounding UI keeps the original stack. Task titles wrap fully into measured-height rows; do not truncate them to keep equal row heights.

Page headings use the headline token; panel headings use title. Body copy is generally 13px, compact supporting information 10–12px on desktop. The overview progress value is 38px, weight 600; the summary headline is 23px, weight 600. Avoid extending these compact desktop sizes into new mobile reading surfaces: the final mobile overrides raise task names to 14px, secondary task/member information to 12px, and form inputs to 16px.

**The File Guidelines Reading Rule.** The `file-guidelines-*` typography roles apply only to the file-collaboration guidance surface; they do not replace the incumbent title/body/label roles. Section headings use the scoped heading role, paragraphs and rule descriptions use the scoped body role, and field labels and desktop textareas use the scoped field role. Rule titles retain their scoped weight and size on desktop and mobile. At the surface's narrow breakpoint, paragraphs and descriptions use the mobile body role and textareas use the mobile textarea role. Filename examples use the scoped monospace role so extensions and version suffixes stay distinguishable. Desktop textareas use a 1.8 line-height; field labels use weight 600. Descriptions are limited to 70ch and long text wraps rather than clipping.

**The Directory Reading Rule.** Drive paragraphs reuse the existing file-guidelines body measurements (14px, 1.85 line-height, 70ch maximum), and narrow-screen paragraphs reuse its mobile body measurements (15px, 1.85 line-height). These are compatible scoped roles, not changes to the global body default. Directory headings are 18px; breadcrumbs and file names are 14px, table headers and result status are 13px. Table cells use a 1.7 line-height, updated times use tabular numerals, and long file names wrap. Mobile search uses the existing readable input treatment (16px); selects retain the inherited workspace font and native controls.

## Layout

Desktop uses a fixed 246px sidebar and 76px header. The main area has a matching left offset, 112px top padding, 36px horizontal padding, and a 1850px maximum width. Overview panels use a 1.65:1 grid with a 26px gap; the four-item metrics strip is flat and divided rather than four floating cards.

- At 1200px and below, navigation narrows to 218px and the main area uses 24px side padding.
- At 900px and below, navigation becomes a hidden off-canvas panel, opened under the 64px header. Hidden navigation is also visibility-hidden so its controls cannot receive focus. Main content loses the sidebar offset; the header date is hidden.
- At 600px and below, main side padding is 16px, overview panels stack, metrics use two columns, and task-composer/edit fields become one column. Search takes a full row. Login changes from a split composition to a stacked page.
- At 1700px and above, main side padding grows to 50px and overview panels gain space.

Calendar retains an internal horizontal overflow surface and a 480px minimum grid below 900px. The new Gantt uses a scrollable SVG report, at least 1040px wide, with frozen label columns 450px wide on desktop. At 600px and below, the frozen overlay clips to 225px so the task title stays visible without covering the timeline; underlying date columns and exported report retain their full geometry. Do not force these data views to shrink until labels become unreadable.

File guidelines use a reading-first desktop grid: rules take 1.35fr and reference examples plus the notice template take 1fr, with the existing section gap. At 1100px and below, the rules sit above two reference columns. At 650px and below, the references become one column and rules-panel padding reduces from 24px to 18px. These surface breakpoints supplement the existing workspace navigation and content breakpoints.

**The Contained Directory Rule.** The Drive table retains a 720px minimum width inside its own horizontal scroll container; the workspace itself must still fit the viewport. The first column receives 38% of the table width. Connection actions, breadcrumbs, controls and result status wrap. At 650px and below, search takes a full row, the two readable selects share the next row, and connection actions use the full available width. Keep the remaining table columns accessible by horizontal scrolling instead of compressing file names, timestamps and preview links.

## Elevation & Depth

The working surface is primarily flat: tonal fills, fine borders and spacing establish hierarchy. Preserved legacy card shadows are removed within the workspace. Exceptions are the modal shadow and the open mobile navigation shadow, recorded in `.impeccable/design.json`. Do not add hover scaling to task or calendar cards.

Motion is short and functional: button color transitions take 180ms, mobile navigation takes 200ms, and the composer reveals over 250ms. Reduced-motion preferences disable animations, transitions, and smooth scrolling.

## Shapes

Use the frontmatter radii: compact controls, slightly softer navigation, rounded task cards and larger panels. Avatars remain circular; icons use the local outline SVG family with a 24px viewBox, 1.7px stroke, round caps and joins. Icons are decorative and aria-hidden; icon-only buttons need an accessible label.

## Components

- **Navigation:** label plus icon, optional task count, 46px minimum row height. Active destinations use `aria-current`; mobile toggle exposes `aria-expanded`, and Escape closes navigation. Retain the skip-to-main link.
- **Buttons:** primary blue, secondary white with a fine border, and blue text actions. Hover darkens or lightly tints the surface. Global keyboard focus uses a visible 3px outline with a 3px offset. Disabled buttons use reduced opacity and a not-allowed cursor; native disabled behavior must remain intact.
- **Fields:** white fill, 8px corners, 40px minimum height, 9px by 12px padding. Search focus encloses the whole search field. Retain visible labels and accessible names. Opening the task composer focuses its title; an empty title returns focus there and reports an error.
- **Overview:** progress has an accessible progressbar value; metrics link to relevant views. Deadline rows open the task editor, combining a date block, task/assignee information and a written status. Empty deadlines and empty membership have explanatory copy instead of invented values.
- **Task board:** muted column surfaces and bordered white task cards, with text plus small color markers for status. On mobile, action buttons have a 40px minimum height and task text is enlarged.
- **Editor:** a native `dialog` opened with `showModal()`, preserving browser modal focus containment and Escape behavior. The transparent dialog wrapper is limited to the viewport, scrolls internally, and contains a white rounded form. The backdrop dims the rest of the workspace.
- **Feedback and loading:** success uses a polite status region; errors use an alert region. Dismiss controls have names. Loading names the activity and offers reload on failure. The login overlay makes underlying header, sidebar and main content inert.
- **Demo:** always show the demonstration banner explaining that data resets on refresh. Demo is isolated from backend mutations. A successful demo interaction is not evidence that Google login, Firestore permissions or external integrations were verified live.
- **Gantt:** date-range controls include the whole selected end date; day, week, month and fit scales adapt ticks without rounding task bars to days. Geometry uses actual timestamps, and labels show date and minute. Equal start/end times use a diamond; clipped bars have boundary arrows. A dagger identifies creation-time or completion-time fallback dates. Missing or reversed dates and out-of-range rows are counted explicitly. Weekend shading and the current-time dashed line provide context. Rows support keyboard selection and show exact details; order controls use 6px corners and retain saved colors.
- **Gantt presentation/export:** native full-viewport modal dialog offers scale and export controls; Escape or close returns focus to the launch button. SVG/PNG export includes every row in the selected range/filter, full wrapped task titles, dates, timezone, filter context, legend and demo marking, independent of scroll position. Export buttons disable during processing; invalid/oversized layouts show guidance. PNG has a bounded raster size and recommends SVG when too large. Printing hides controls and frozen duplicates.
- **Legacy views:** scoped bridge rules bring calendar, rankings and account controls into the same palette and spacing. Gantt now has its own report component and stylesheet. Prefer existing semantic classes for new UI; audit bridge specificity before changing shared utility styling.

### File collaboration guidelines

This surface inherits Project Studio's navy/light palette, flat white rules panel, fine dividers, and existing primary/secondary buttons. It pairs a semantic definition list of rules with filename/preview examples and an editable update-notice template; the scoped typography roles support extended reading without changing the shared design system. Reference sections remain flat rather than becoming elevated cards.

**The Temporary Notice Rule.** The notice is held only in component memory and resets to the blank template when the page is exited or reloaded. It is not an autosaved draft or a backend operation. Clipboard actions report their result in a polite status region and disable while copying; failure exposes selectable rule text or directs the reader to select the existing notice manually. Keep the scope note that cloud permissions and versions are managed by the original storage service. This page neither uploads files nor sends group messages.

### Drive directory

The directory inherits the navy/light workspace, blue text actions, existing primary/secondary buttons and native fields. Its flat white table has a fine border, the existing board corner radius, and the existing pale report-month fill for column headings. Outline folder/file icons accompany names without introducing a new icon family. A semantic breadcrumb labels the current folder and exposes ancestor navigation; folder names open child folders. Search and type filters operate on already loaded files in the current folder, with folders first and either natural name order or most recently updated order. They are not a recursive Drive search.

Blender rows link to loaded PNG/JPEG images with the same complete version-bearing filename stem, case-insensitively. For example, `Office_Desk_v003.blend` matches `Office_Desk_v003.png`, not `Office_Desk_v002.png`. The preview is a labeled external Drive link rather than an inline image or copied file. If additional pages remain, a missing match is described only as missing among loaded items. Retain loading status, displayed/loaded counts, read time, empty-folder and empty-filter explanations, incomplete-result guidance, error alerts, load-more pagination and manual refresh; disable refresh and load-more during loading.

**The Directory Session Rule.** The primary action is 讀取雲端目錄; an open session offers 關閉目錄. Each directory request obtains the current CampusFlow user's Firebase ID token. The backend verifies its signature, checks that the user's current profile belongs to the designated project group, and reads the corresponding membership document under the caller's Firestore rules. A dedicated service account requests only `drive.metadata.readonly`; the backend enforces the configured project root and its descendants. Directory metadata stays in component memory only. The account/group-keyed component remount isolates sessions when either identity changes; leaving the directory, reload or closing the directory clears its session and metadata. There is no per-user Drive OAuth consent flow. File and image links open Google Drive and still require the reader's own Drive sharing permissions. This directory does not copy, download, upload or delete Drive content.

The demo uses clearly labeled fictional metadata and makes no directory-backend or Drive network requests. The v02 desktop and mobile reference screenshots in `../../output/campusflow-release/drive-*-v02.png` establish layout and contained table scrolling. Validation recorded successful root/descendant metadata reads with the dedicated service account, rejection of unauthenticated requests, forged tokens and disallowed origins by the deployed backend, 21 passing unit tests, and passing synthetic desktop/mobile UI checks. A real project member's complete production login and directory flow has not been exercised; these checks do not establish that remaining end-user path.

## Do's and Don'ts

- **Do** keep Traditional Chinese copy, keyboard focus, written status labels, empty/error/loading states, and existing role-dependent functions.
- **Do** check both 900px navigation behavior and 600px content reflow when adding screens.
- **Do** preserve internal timeline/calendar scrolling, long-text wrapping, and readable mobile fields.
- **Do** keep Drive filters and same-version image matching explicitly limited to loaded metadata, with the table scroll contained on mobile.
- **Do** keep precise time geometry and complete report labels when changing the Gantt; tick density must not alter task duration.
- **Don't** reintroduce slogans or motivational filler in functional headings.
- **Don't** turn every metric into an elevated card or add decorative gradients and scale effects to this flat workspace.
- **Don't** hide demo labeling or claim live integration validation from sample data.
- **Don't** treat visual documentation as authorization to alter data schemas, permissions, or saved task colors.
