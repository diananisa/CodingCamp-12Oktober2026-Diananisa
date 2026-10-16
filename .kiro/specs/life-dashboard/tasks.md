# Implementation Plan: Life Dashboard

## Overview

Implement a zero-dependency, client-side Life Dashboard as three static files (`index.html`, `css/style.css`, `js/app.js`). All logic lives in Vanilla JS ES2020 using an IIFE module pattern. Widgets are independent; shared concerns go through `StorageManager`. Persistence uses `localStorage` only. Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) and cover all 11 correctness properties from the design.

---

## Tasks

- [x] 1. Create the static file scaffold and HTML shell
  - [x] 1.1 Create `index.html` with semantic landmark sections
    - Add `<section id="greeting-section">`, `<section id="timer-section">`, `<section id="todo-section">`, `<section id="links-section">`
    - Include `<link rel="stylesheet" href="css/style.css">` and `<script type="module" src="js/app.js">` (or defer non-module)
    - Add a global warning banner element (`role="alert"`, `aria-live="polite"`, hidden by default) for storage errors
    - _Requirements: 6.1, 6.4, 6.5, 5.4_
  - [x] 1.2 Create `css/style.css` with layout foundation and CSS custom properties
    - Define CSS custom properties for colors, spacing, and font sizes
    - Implement multi-column grid layout (≥2 and ≤4 columns) for viewport ≥ 768 px, single-column stacked layout for < 768 px
    - Apply minimum body font size of 16px; headings at least 1.25× body size; minimum 16px section spacing
    - Ensure WCAG 2.1 AA color contrast (4.5:1 normal text, 3:1 large text)
    - Add placeholder `.widget-error` class with a fixed minimum height so layout does not collapse on render failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_
  - [x] 1.3 Create `js/app.js` skeleton with `StorageManager` IIFE and `AppCore.init()`
    - Define `StorageManager` with `TASKS_KEY`, `LINKS_KEY`, `read(key)`, and `write(key, data)` stubs
    - `read()` must return `[]` on missing key, invalid JSON, or any error; show global warning banner on error
    - `write()` must return `true` on success or `false` on error; show global warning banner on error; wrap all `localStorage` access in `try/catch`
    - Define `AppCore.init()` that calls each widget's `init()` in order after `DOMContentLoaded`; wrap each call in try/catch and insert placeholder `<div>` on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.8_

- [x] 2. Implement `GreetingWidget`
  - [x] 2.1 Implement `GreetingWidget` module with clock, formatting, and greeting logic
    - Implement `getGreeting(hour)`: 05–11 → "Good Morning", 12–17 → "Good Afternoon", 18–21 → "Good Evening", 22–23 and 00–04 → "Good Night"
    - Implement `formatTime(date)`: returns `"HH:MM"` string (zero-padded, 24-hour)
    - Implement `formatDate(date)`: returns `"Day-of-Week, DD Month YYYY"` (e.g., "Monday, 12 October 2026")
    - Implement `tick()`: computes current values, only updates DOM nodes when the displayed value would change
    - Implement `startClock()` using `setInterval(tick, 1000)`; call `tick()` immediately on `init()` before the interval fires
    - Wire into `#greeting-section` DOM; render time, date, and greeting on `init()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [x]* 2.2 Write property test for `getGreeting` — Property 1
    - **Property 1: Greeting maps every hour to exactly one greeting**
    - Generator: `fc.integer({min: 0, max: 23})`
    - Assert: result is one of {"Good Morning", "Good Afternoon", "Good Evening", "Good Night"}; assert full partition (no gaps, no overlaps across all 24 hours)
    - Tag comment: `// Feature: life-dashboard, Property 1: Greeting maps every hour to exactly one greeting`
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
  - [x]* 2.3 Write property test for `formatTime` — Property 2
    - **Property 2: Time format always produces HH:MM**
    - Generator: `fc.date()`
    - Assert: output matches `/^\d{2}:\d{2}$/`; hours in [00, 23], minutes in [00, 59]
    - Tag comment: `// Feature: life-dashboard, Property 2: Time format always produces HH:MM`
    - **Validates: Requirements 1.1**
  - [x]* 2.4 Write property test for `formatDate` — Property 3
    - **Property 3: Date format always produces the canonical pattern**
    - Generator: `fc.date()`
    - Assert: output matches `/^[A-Za-z]+, \d{2} [A-Za-z]+ \d{4}$/`
    - Tag comment: `// Feature: life-dashboard, Property 3: Date format always produces the canonical pattern`
    - **Validates: Requirements 1.2**

- [x] 3. Implement `FocusTimerWidget`
  - [x] 3.1 Implement `FocusTimerWidget` module with countdown, controls, and button state matrix
    - Initialize `timerState = { totalSeconds: 1500, intervalId: null, isRunning: false }`
    - Implement `formatCountdown(s)`: converts seconds → `"MM:SS"` zero-padded string
    - Implement `start()`: set `intervalId = setInterval(tick, 1000)`, set `isRunning = true`, call `updateButtonStates()`; no-op if already running
    - Implement `stop()`: `clearInterval(intervalId)`, set `isRunning = false`, call `updateButtonStates()`
    - Implement `reset()`: call `stop()`, set `totalSeconds = 1500`, call `render()`
    - Implement `tick()`: `totalSeconds = Math.max(0, totalSeconds - 1)`; if `totalSeconds <= 0` call `stop()` then `showTimesUp()`; else call `renderDisplay()`
    - Implement `showTimesUp()`: render "Time's up!" message; auto-hide after 5 seconds
    - Implement `updateButtonStates()` per the button state matrix (Start/Stop/Reset enabled states)
    - Wire into `#timer-section` DOM; attach click listeners to Start, Stop, Reset buttons on `init()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [x]* 3.2 Write property test for `formatCountdown` — Property 4
    - **Property 4: Timer countdown format always produces MM:SS**
    - Generator: `fc.integer({min: 0, max: 1500})`
    - Assert: output matches `/^\d{2}:\d{2}$/`; minutes in [00, 25], seconds in [00, 59]
    - Tag comment: `// Feature: life-dashboard, Property 4: Timer countdown format always produces MM:SS`
    - **Validates: Requirements 2.2, 2.8**

- [x] 4. Checkpoint — Core widgets functional
  - Ensure `GreetingWidget`, `FocusTimerWidget`, and `StorageManager` render correctly in `index.html` with no console errors. Ask the user if questions arise.

- [x] 5. Implement `TodoListWidget`
  - [x] 5.1 Implement `TodoListWidget` module with task state, CRUD operations, and persistence
    - Define in-memory state: `tasks: Array<Task>`, `editingId: string | null`
    - Implement `generateId()`: `crypto.randomUUID()` with `Date.now().toString()` fallback
    - Implement `addTask(description)`: trim input; reject empty/whitespace-only with inline `<p role="alert">` under the field and return focus to input; reject if `> 500 chars`; otherwise create `{ id, text, completed: false, createdAt: Date.now() }`, push to `tasks`, call `persist()`, call `render()`
    - Implement `toggleComplete(id)`: flip `task.completed`, call `persist()`, call `render()`
    - Implement `startEdit(id)`: set `editingId = id`, call `render()`
    - Implement `confirmEdit(id, newText)`: if trimmed empty → call `cancelEdit()`; else update `task.text`, set `editingId = null`, call `persist()`, call `render()`
    - Implement `cancelEdit()`: set `editingId = null`, call `render()`; also bind Escape key listener during edit mode
    - Implement `deleteTask(id)`: remove task from array, call `persist()`, call `render()`
    - Implement `persist()`: `StorageManager.write(TASKS_KEY, tasks)`
    - Implement `render()`: rebuild `#todo-list` from `tasks[]` and `editingId`; render each task with toggle, edit, and delete controls; visually distinguish completed tasks
    - On `init()`: call `StorageManager.read(TASKS_KEY)`, assign to `tasks`, call `render()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_
  - [ ]* 5.2 Write property test for `addTask` growth — Property 5
    - **Property 5: Adding a task grows the list by exactly one**
    - Generators: `fc.array(taskArb)` + `fc.string({minLength: 1, maxLength: 500}).filter(s => s.trim().length > 0)`
    - Assert: `tasks.length` increases by exactly 1; new task is at the tail; `completed === false`
    - Tag comment: `// Feature: life-dashboard, Property 5: Adding a task grows the list by exactly one`
    - **Validates: Requirements 3.1, 3.3**
  - [ ]* 5.3 Write property test for whitespace rejection — Property 6
    - **Property 6: Whitespace-only descriptions are always rejected**
    - Generator: `fc.stringMatching(/^\s+$/)`
    - Assert: `tasks.length` remains unchanged after calling `addTask`
    - Tag comment: `// Feature: life-dashboard, Property 6: Whitespace-only descriptions are always rejected`
    - **Validates: Requirements 3.2**
  - [ ]* 5.4 Write property test for task serialization round-trip — Property 7
    - **Property 7: Task serialization round-trip preserves data**
    - Generator: `fc.array(taskArb)` where `taskArb` produces valid `{ id, text, completed, createdAt }` objects
    - Assert: `JSON.parse(JSON.stringify(arr))` is deeply equal to `arr`
    - Tag comment: `// Feature: life-dashboard, Property 7: Task serialization round-trip preserves data`
    - **Validates: Requirements 5.2, 5.3**
  - [ ]* 5.5 Write property test for toggle idempotence — Property 8
    - **Property 8: Toggling completion twice restores original state**
    - Generator: `fc.array(taskArb, {minLength: 1})`; pick a random task, record `completed`
    - Assert: after two calls to `toggleComplete(id)`, `task.completed === originalCompleted`
    - Tag comment: `// Feature: life-dashboard, Property 8: Toggling completion twice restores original state`
    - **Validates: Requirements 3.5**

- [x] 6. Implement `QuickLinksWidget`
  - [x] 6.1 Implement `QuickLinksWidget` module with link state, CRUD operations, and persistence
    - Define in-memory state: `links: Array<Link>`
    - Implement `validateUrl(url)`: return `true` iff `url.startsWith('http://') || url.startsWith('https://')` (case-sensitive)
    - Implement `addLink(label, url)`: validate non-empty label (≤ 50 chars) and non-empty URL; call `validateUrl`; enforce 20-link cap (display inline rejection message if at limit); on success create `{ id: generateId(), label: trimmed, url: trimmed }`, push to `links`, call `persist()`, call `render()`
    - Implement `deleteLink(id)`: remove link from array, call `persist()`, call `render()`
    - Implement `persist()`: `StorageManager.write(LINKS_KEY, links)`
    - Implement `render()`: rebuild `#links-grid`; render each link as a `<button>` or `<a target="_blank">` that opens the URL in a new tab; include a delete control per link
    - On `init()`: call `StorageManager.read(LINKS_KEY)`, assign to `links`, call `render()`
    - Inline validation messages for: empty label, empty URL, invalid scheme, 20-link limit reached
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  - [ ]* 6.2 Write property test for URL validation — Property 9
    - **Property 9: Link URL validation enforces scheme prefix**
    - Generator: `fc.string()`
    - Assert: `validateUrl(url)` returns `true` iff `url` starts with `"http://"` or `"https://"`; all other strings (empty, relative, `ftp://`, `//`, `javascript:`) return `false`
    - Tag comment: `// Feature: life-dashboard, Property 9: Link URL validation enforces scheme prefix`
    - **Validates: Requirements 4.3**
  - [ ]* 6.3 Write property test for 20-link cap — Property 10
    - **Property 10: Link collection never exceeds 20 items**
    - Generator: `fc.array(linkArb, {minLength: 20, maxLength: 20})` + one valid extra link
    - Assert: after calling `addLink` with the extra link, `links.length` remains 20; inline rejection message is produced
    - Tag comment: `// Feature: life-dashboard, Property 10: Link collection never exceeds 20 items`
    - **Validates: Requirements 4.10**
  - [ ]* 6.4 Write property test for link serialization round-trip — Property 11
    - **Property 11: Link serialization round-trip preserves data**
    - Generator: `fc.array(linkArb)` where `linkArb` produces valid `{ id, label, url }` objects
    - Assert: `JSON.parse(JSON.stringify(arr))` is deeply equal to `arr`
    - Tag comment: `// Feature: life-dashboard, Property 11: Link serialization round-trip preserves data`
    - **Validates: Requirements 5.2, 5.3**

- [ ] 7. Checkpoint — All widgets functional end-to-end
  - Ensure all four widgets render in `index.html`, data persists across reload, and no console errors appear. Ask the user if questions arise.

- [ ] 8. Wire `AppCore.init()` and finalize integration
  - [ ] 8.1 Complete `AppCore.init()` wiring and error boundaries
    - Call `StorageManager.init()` (if any setup needed), then `GreetingWidget.init()`, `FocusTimerWidget.init()`, `TodoListWidget.init()`, `QuickLinksWidget.init()` in that order on `DOMContentLoaded`
    - Wrap each widget `init()` in `try/catch`; on failure insert a placeholder `<div>` with `class="widget-error"` of the same minimum height so layout does not collapse
    - _Requirements: 5.6, 6.8_
  - [ ] 8.2 Add ARIA labels and keyboard-navigation attributes to all interactive controls
    - Add `aria-label` to icon-only buttons (delete, edit, toggle); add `role="list"` / `role="listitem"` where appropriate
    - Verify Tab order reaches every interactive control; Enter/Space activates all buttons
    - Ensure warning banner uses `role="alert"` and `aria-live="polite"` with a dismiss button
    - _Requirements: 6.3 (WCAG 2.1 AA accessibility)_
  - [ ]* 8.3 Write unit tests for `StorageManager` error handling
    - Mock `localStorage` to throw `QuotaExceededError` on write; assert `write()` returns `false` and warning banner appears
    - Mock `localStorage` to return invalid JSON on read; assert `read()` returns `[]` and warning banner appears
    - Mock `localStorage` to be entirely unavailable; assert all widgets render empty with warning banners shown
    - _Requirements: 5.4, 3.13, 4.8, 4.9_

- [ ] 9. Style polish and responsive layout
  - [ ] 9.1 Apply final CSS for widget cards, typography, and interactive states
    - Style all four widget sections as visually distinct cards with at least 16px section spacing
    - Apply hover/focus/active states for all buttons; ensure focus rings are visible for keyboard navigation
    - Style completed tasks with a visual distinction (e.g., line-through, reduced opacity)
    - Style the "Time's up!" message and global warning banner prominently
    - Verify multi-column grid (≥2 columns, ≤4 columns) at ≥ 768 px and single-column stacked at < 768 px
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7_

- [ ] 10. Final checkpoint — Full validation
  - Ensure all property-based tests run (minimum 100 iterations each), all unit tests pass, responsive layout is correct at 320 px and 1280 px viewports, and no console errors occur on page load or during widget interactions. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but are strongly recommended — the 11 property tests validate correctness guarantees defined in the design
- Each property test MUST run a minimum of **100 iterations** and be tagged with `// Feature: life-dashboard, Property <N>: <property_text>`
- `fast-check` can be loaded via CDN (`<script src="https://cdn.jsdelivr.net/npm/fast-check/dist/fast-check.min.js">`) in a test HTML file, or used as a Node.js script — no build tool required
- All `localStorage` access is isolated inside `StorageManager`; widgets never call `localStorage` directly
- `generateId()` uses `crypto.randomUUID()` with `Date.now().toString()` as fallback for broader compatibility
- The single-file constraint means `js/app.js` uses IIFEs (not ES module `import/export`) so it works with a plain `<script>` tag

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "9.1"] }
  ]
}
```
