# Requirements Document

## Introduction

The Life Dashboard is a client-side web application that serves as a personal productivity hub. It combines a contextual greeting with the current time and date, a Pomodoro-style focus timer, a persistent to-do list, and a customizable quick-links panel. The entire application runs in a single browser tab with no backend server; all persistent data is stored in the browser's Local Storage. The app must work as a standalone web page or as a browser extension in Chrome, Firefox, Edge, and Safari.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Greeting_Widget**: The UI component that displays the current time, date, and a time-of-day greeting.
- **Focus_Timer**: The UI component that implements a 25-minute countdown timer.
- **Todo_List**: The UI component that manages a list of user-defined tasks.
- **Task**: A single user-created item in the Todo_List, containing at minimum a text description and a completion status.
- **Quick_Links**: The UI component that displays a set of user-defined link buttons, each consisting of a label and a URL.
- **Link**: A single user-defined entry in the Quick_Links component, consisting of a label and a URL.
- **Storage**: The browser's `localStorage` API used as the sole persistence mechanism.
- **Modern_Browser**: Any current release of Chrome, Firefox, Edge, or Safari.

---

## Requirements

### Requirement 1: Contextual Greeting

**User Story:** As a user, I want to see the current time, date, and a greeting suited to the time of day, so that the Dashboard feels personalized and oriented in time.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current local time in HH:MM (24-hour) format.
2. THE Greeting_Widget SHALL display the current local date in the format "Day-of-Week, DD Month YYYY" (e.g., "Monday, 12 October 2026").
3. WHEN the local hour is between 05:00 and 11:59 (inclusive), THE Greeting_Widget SHALL display the greeting "Good Morning".
4. WHEN the local hour is between 12:00 and 17:59 (inclusive), THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. WHEN the local hour is between 18:00 and 21:59 (inclusive), THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHEN the local hour is between 22:00 and 04:59 (inclusive), THE Greeting_Widget SHALL display the greeting "Good Night".
7. WHEN the system clock advances to a new minute, THE Greeting_Widget SHALL update the displayed time and, if the hour has changed, update the displayed greeting without requiring a page reload.
8. WHEN the system clock advances past midnight, THE Greeting_Widget SHALL update the displayed date without requiring a page reload.

---

### Requirement 2: Focus Timer

**User Story:** As a user, I want a 25-minute countdown timer with start, stop, and reset controls, so that I can time focused work sessions.

#### Acceptance Criteria

1. WHEN the Focus_Timer component is loaded, THE Focus_Timer SHALL display a countdown value of 25 minutes and 00 seconds (25:00) in MM:SS format.
2. WHEN the user clicks or taps the Start control, THE Focus_Timer SHALL begin counting down from the current displayed time at a rate of one second per second.
3. WHEN the user clicks or taps the Stop control, THE Focus_Timer SHALL pause the countdown and retain the current remaining time.
4. WHEN the user clicks or taps the Reset control, THE Focus_Timer SHALL stop any active countdown and reset the displayed time to 25:00.
5. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop automatically and display a visible on-screen message reading "Time's up!" for a minimum of 5 seconds.
6. WHILE the countdown is running, THE Focus_Timer SHALL disable the Start control and keep the Stop and Reset controls enabled.
7. WHILE the countdown is paused or stopped, THE Focus_Timer SHALL enable the Start control and disable the Stop control.
8. THE Focus_Timer SHALL display the remaining time in MM:SS format at all times.

---

### Requirement 3: To-Do List

**User Story:** As a user, I want to add, edit, complete, and delete tasks, and have those tasks persist across browser sessions, so that I can track my work over time.

#### Acceptance Criteria

1. THE Todo_List SHALL provide an input field (accepting 1–500 characters) and a submit control that allow the user to add a new Task with a non-empty text description.
2. IF the user attempts to submit an empty or whitespace-only text description, THEN THE Todo_List SHALL reject the submission and display an inline validation message.
3. WHEN a new Task is added, THE Todo_List SHALL append it to the list in an incomplete state and persist the updated task collection to Storage within 1 second.
4. THE Todo_List SHALL display each Task with its text description, a toggle control for completion status (visually distinguishing completed tasks from incomplete ones), an edit control, and a delete control.
5. WHEN the user activates the completion toggle on a Task, THE Todo_List SHALL update the Task's completion status and persist the change to Storage within 1 second.
6. WHEN the user activates the edit control on a Task, THE Todo_List SHALL present the Task's text in an editable field pre-filled with the current description.
7. WHEN the user confirms an edit with a non-empty text description (1–500 characters), THE Todo_List SHALL update the Task's text, exit edit mode, and persist the change to Storage within 1 second.
8. IF the user attempts to confirm an edit with an empty or whitespace-only text description, THEN THE Todo_List SHALL retain the original Task text and exit edit mode without saving.
9. WHEN the user activates the cancel control or presses the Escape key during edit mode, THE Todo_List SHALL discard any unsaved changes and exit edit mode, restoring the original Task text.
10. WHEN the user activates the delete control on a Task, THE Todo_List SHALL remove the Task from the list and persist the updated task collection to Storage within 1 second.
11. WHEN the Dashboard loads, THE Todo_List SHALL read the task collection from Storage and render all previously saved Tasks within 1 second.
12. WHEN Storage contains no task data, THE Todo_List SHALL render an empty list with no error.
13. IF Storage is unavailable or throws an error during a read or write operation, THEN THE Todo_List SHALL display an inline error message and continue operating with the current in-memory task state.

---

### Requirement 4: Quick Links

**User Story:** As a user, I want to save and access my favorite website links as buttons on the Dashboard, so that I can open them with a single click without leaving or memorizing URLs.

#### Acceptance Criteria

1. THE Quick_Links component SHALL provide an input field for a label (maximum 50 characters) and an input field for a URL (maximum 2048 characters), and a submit control to add a new Link.
2. IF the user attempts to add a Link with an empty label or an empty URL, THEN THE Quick_Links component SHALL reject the submission and display an inline validation message indicating which field is missing.
3. IF the user attempts to add a Link with a URL that does not begin with "http://" or "https://", THEN THE Quick_Links component SHALL reject the submission and display an inline validation message indicating the URL format requirement.
4. WHEN a new Link is added, THE Quick_Links component SHALL render it as a clickable button and persist the updated link collection to Storage before the add operation is considered complete.
5. WHEN the user activates a Link button, THE Quick_Links component SHALL open the associated URL in a new browser tab.
6. WHEN the user activates the delete control on a Link button, THE Quick_Links component SHALL remove that Link from the collection and persist the updated link collection to Storage before the delete operation is considered complete.
7. WHEN the Dashboard loads, THE Quick_Links component SHALL read the link collection from Storage and render all previously saved Links.
8. IF Storage is unavailable or returns an error when the Dashboard loads, THEN THE Quick_Links component SHALL render an empty panel and display an inline error message indicating that links could not be loaded.
9. IF Storage is unavailable or returns an error when persisting a link collection change, THEN THE Quick_Links component SHALL retain the previous link collection state and display an inline error message indicating that the change could not be saved.
10. THE Quick_Links component SHALL support a maximum of 20 saved Links; IF the user attempts to add a Link when 20 Links are already saved, THEN THE Quick_Links component SHALL reject the submission and display an inline message indicating the limit has been reached.
11. WHEN Storage contains no link data, THE Quick_Links component SHALL render an empty panel with no error.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want all my tasks and links to be automatically saved, so that my data is still there after I close and reopen the browser.

#### Acceptance Criteria

1. THE Dashboard SHALL use the Storage API as the sole mechanism for persisting Task and Link data; no server requests SHALL be made.
2. WHEN a Task or Link is created, updated, or deleted, THE Dashboard SHALL serialize the updated collection to JSON and write it to Storage before the operation is considered complete.
3. THE Dashboard SHALL serialize Task and Link collections to JSON before writing to Storage and deserialize from JSON when reading from Storage.
4. IF Storage is unavailable or throws an error, or if the stored value is not valid JSON, during a read or write operation, THEN THE Dashboard SHALL display a non-blocking warning message to the user and continue operating with in-memory state.
5. THE Dashboard SHALL store Task data and Link data under separate, uniquely named Storage keys to avoid key collisions.
6. WHEN the Dashboard initializes, THE Dashboard SHALL read and deserialize the Task and Link collections from Storage before rendering any widget content.

---

### Requirement 6: Layout and Visual Design

**User Story:** As a user, I want a clean, readable, and visually organized dashboard, so that I can locate and use each widget quickly without cognitive effort.

#### Acceptance Criteria

1. THE Dashboard SHALL organize the Greeting_Widget, Focus_Timer, Todo_List, and Quick_Links into visually distinct sections within a single HTML page, where each section is separated by at least 16px of spacing.
2. THE Dashboard SHALL apply a consistent typographic scale with a minimum body font size of 16px and heading font sizes at least 1.25× the body size.
3. THE Dashboard SHALL provide color contrast between text and background in each section at a ratio of at least 4.5:1 for normal text and 3:1 for large text, meeting WCAG 2.1 Level AA.
4. THE Dashboard SHALL use a single CSS file located at `css/style.css` for all styling.
5. THE Dashboard SHALL use a single JavaScript file located at `js/app.js` for all scripting.
6. WHEN the viewport width is 768px or wider, THE Dashboard SHALL display the widgets in a multi-column grid layout with a minimum of 2 columns and a maximum of 4 columns.
7. WHEN the viewport width is below 768px, THE Dashboard SHALL display the widgets in a single-column stacked layout where each widget occupies 100% of the viewport width.
8. WHEN a widget section fails to render its content, THE Dashboard SHALL display a placeholder area of the same minimum height as the widget so the overall layout does not collapse.

---

### Requirement 7: Browser Compatibility

**User Story:** As a user, I want the Dashboard to work correctly across all modern browsers, so that I can use it regardless of my preferred browser or operating system.

#### Acceptance Criteria

1. THE Dashboard SHALL, in the current stable release of Chrome, Firefox, Edge, and Safari at the time of the Dashboard's release: (a) render the layout without visual breakage, (b) execute all JavaScript without uncaught errors, and (c) display persisted data correctly after a page reload — without requiring browser-specific polyfills or plugins.
2. THE Dashboard SHALL use only standard HTML5, CSS3, and ECMAScript 2020 (ES11) or earlier JavaScript features.
3. WHEN the Dashboard's assets have been loaded at least once, THE Dashboard SHALL operate fully without initiating any fetch, XMLHttpRequest, or WebSocket network requests.
4. IF a network request is somehow triggered after the initial load, THE Dashboard SHALL display the last successfully loaded data and not show an error to the user.
