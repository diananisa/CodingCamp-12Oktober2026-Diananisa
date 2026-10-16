/**
 * Life Dashboard — js/app.js
 *
 * All logic lives in a single top-level IIFE so no ES-module import/export
 * syntax is needed and the file works with a plain <script> tag.
 *
 * Internal structure:
 *   StorageManager   — thin localStorage wrapper (read / write / error banner)
 *   GreetingWidget   — time, date, greeting display + custom name
 *   FocusTimerWidget — Pomodoro countdown (custom focus/break minutes)
 *   TodoListWidget   — task CRUD + persistence
 *   QuickLinksWidget — link CRUD + persistence
 *   AppCore          — initialization orchestrator
 */

(function () {
  'use strict';

  /* =========================================================================
   * STORAGE MANAGER
   * Wraps all localStorage access.  Widgets never call localStorage directly.
   * ========================================================================= */

  const StorageManager = (function () {
    const TASKS_KEY = 'lifeDashboard_tasks';
    const LINKS_KEY = 'lifeDashboard_links';

    /**
     * Show the global warning banner with the supplied message.
     * Matches the banner element with id="warning-banner" defined in index.html.
     * Visibility is controlled via the "is-visible" CSS class.
     * @param {string} message
     */
    function showWarningBanner(message) {
      const banner = document.getElementById('warning-banner');
      if (!banner) return;

      const msgEl = document.getElementById('warning-banner-message');
      if (msgEl) {
        msgEl.textContent = message;
      } else {
        banner.textContent = message;
      }

      banner.classList.add('is-visible');
    }

    /**
     * Read a JSON-serialised array from localStorage.
     *
     * @param {string} key — storage key to read
     * @returns {Array<object>} Parsed array, or [] on any failure
     */
    function read(key) {
      try {
        const raw = localStorage.getItem(key);

        // Key not present → return empty array (not an error)
        if (raw === null) {
          return [];
        }

        const parsed = JSON.parse(raw);

        // Guard against stored non-array values
        if (!Array.isArray(parsed)) {
          showWarningBanner(
            'Stored data for "' + key + '" was in an unexpected format and has been reset.'
          );
          return [];
        }

        return parsed;
      } catch (err) {
        // JSON.parse failure or any localStorage error
        showWarningBanner(
          'Could not load saved data (' + key + '). Your data may not have persisted correctly.'
        );
        return [];
      }
    }

    /**
     * Serialise data to JSON and write it to localStorage.
     *
     * @param {string}        key  — storage key to write
     * @param {Array<object>} data — array to serialise and persist
     * @returns {boolean} true on success, false on any error
     */
    function write(key, data) {
      try {
        const serialised = JSON.stringify(data);
        localStorage.setItem(key, serialised);
        return true;
      } catch (err) {
        // QuotaExceededError, SecurityError, or any other storage failure
        showWarningBanner(
          'Could not save your data (' + key + '). ' +
          'Changes are kept for this session but will not persist after reload.'
        );
        return false;
      }
    }

    /** Read a plain string value (e.g. name, theme). Returns fallback on failure. */
    function readValue(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (err) {
        return fallback;
      }
    }

    /** Write a plain string value. Returns true on success. */
    function writeValue(key, value) {
      try {
        localStorage.setItem(key, String(value));
        return true;
      } catch (err) {
        showWarningBanner(
          'Could not save your settings (' + key + '). They will not persist after reload.'
        );
        return false;
      }
    }

    // Public API
    return {
      TASKS_KEY,
      LINKS_KEY,
      NAME_KEY:  'customName',
      FOCUS_KEY: 'focusTime',
      BREAK_KEY: 'breakTime',
      THEME_KEY: 'dashboard-theme',
      read,
      write,
      readValue,
      writeValue,
    };
  })();

  /* =========================================================================
   * GREETING WIDGET
   * Owns #greeting-section.  Displays time, date, and a time-of-day greeting.
   * Updates via a 1-second interval; only writes to the DOM when the value
   * actually changes (avoids unnecessary reflows / screen-reader noise).
   * ========================================================================= */

  const GreetingWidget = (function () {
    // Cache DOM references — set once during init()
    let _timeEl = null;
    let _dateEl = null;
    let _textEl = null;

    // Remember the last rendered values so we skip no-op DOM writes
    let _lastTime = '';
    let _lastDate = '';
    let _lastGreeting = '';

    // Custom name + its input/button
    let _name = '';
    let _nameInput = null;
    let _saveBtn = null;

    /**
     * Map an hour (0–23) to the correct greeting string.
     * Ranges: 05–11 → Morning, 12–17 → Afternoon, 18–21 → Evening,
     *         22–23 and 00–04 → Night.
     *
     * @param {number} hour — integer in [0, 23]
     * @returns {string}
     */
    function getGreeting(hour) {
      if (hour >= 5 && hour <= 11) return 'Good Morning';
      if (hour >= 12 && hour <= 17) return 'Good Afternoon';
      if (hour >= 18 && hour <= 21) return 'Good Evening';
      return 'Good Night'; // 22–23 and 00–04
    }

    /**
     * Greeting text including the custom name, e.g. "Good Morning, Dian".
     * @param {number} hour
     * @returns {string}
     */
    function buildGreeting(hour) {
      const base = getGreeting(hour);
      return _name ? base + ', ' + _name : base;
    }

    /** Save the name from the input, persist it and refresh the greeting. */
    function saveName() {
      _name = (_nameInput ? _nameInput.value : '').trim();
      StorageManager.writeValue(StorageManager.NAME_KEY, _name);
      if (_nameInput) _nameInput.value = _name;
      tick();
    }

    /**
     * Format a Date as "HH:MM" (24-hour, zero-padded).
     *
     * @param {Date} date
     * @returns {string}
     */
    function formatTime(date) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    }

    /**
     * Format a Date as "Day-of-Week, DD Month YYYY"
     * e.g. "Monday, 12 October 2026".
     *
     * @param {Date} date
     * @returns {string}
     */
    function formatDate(date) {
      const DAYS = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday',
      ];
      const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];

      const dayName  = DAYS[date.getDay()];
      const dd       = String(date.getDate()).padStart(2, '0');
      const monthName = MONTHS[date.getMonth()];
      const yyyy     = date.getFullYear();

      return dayName + ', ' + dd + ' ' + monthName + ' ' + yyyy;
    }

    /**
     * Compute current time/date/greeting and update DOM nodes only when the
     * displayed value would change (Requirement 1.7, 1.8).
     */
    function tick() {
      const now      = new Date();
      const timeStr  = formatTime(now);
      const dateStr  = formatDate(now);
      const greeting = buildGreeting(now.getHours());

      if (_timeEl && timeStr !== _lastTime) {
        _timeEl.textContent = timeStr;
        _lastTime = timeStr;
      }

      if (_dateEl && dateStr !== _lastDate) {
        _dateEl.textContent = dateStr;
        _lastDate = dateStr;
      }

      if (_textEl && greeting !== _lastGreeting) {
        _textEl.textContent = greeting;
        _lastGreeting = greeting;
      }
    }

    /**
     * Start a 1-second interval that calls tick().
     * tick() is also called immediately so the display is populated without
     * waiting for the first interval to fire (Requirement 1.7).
     */
    function startClock() {
      setInterval(tick, 1000);
    }

    /**
     * Initialise the widget: cache DOM nodes, render immediately, start clock.
     */
    function init() {
      _timeEl = document.getElementById('greeting-time');
      _dateEl = document.getElementById('greeting-date');
      _textEl = document.getElementById('greeting-text');
      _nameInput = document.getElementById('custom-name');
      _saveBtn   = document.getElementById('save-name');

      // Load saved name
      _name = StorageManager.readValue(StorageManager.NAME_KEY, '').trim();
      if (_nameInput) {
        _nameInput.value = _name;
        _nameInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); saveName(); }
        });
      }
      if (_saveBtn) _saveBtn.addEventListener('click', saveName);

      // Render current values right away, then start the interval
      tick();
      startClock();
    }

    // Expose public API (pure functions exposed for property-based testing)
    return {
      init,
      getGreeting,
      formatTime,
      formatDate,
    };
  })();

  /* =========================================================================
   * FOCUS TIMER WIDGET
   * Manages a 25-minute (1500-second) countdown with Start, Stop, and Reset
   * controls.  State is kept in memory only (no persistence needed).
   * ========================================================================= */

  const FocusTimerWidget = (function () {
    /** @type {{ totalSeconds: number, intervalId: number|null, isRunning: boolean }} */
    const timerState = {
      totalSeconds: 1500,
      intervalId:   null,
      isRunning:    false,
      mode:         'focus',   // 'focus' | 'break'
      focusMinutes: 25,
      breakMinutes: 5,
    };

    const LIMITS = { focus: { min: 1, max: 120 }, rest: { min: 1, max: 60 } };

    // Cached DOM references — populated in init()
    let elDisplay  = null;
    let elMessage  = null;
    let elStart    = null;
    let elStop     = null;
    let elReset    = null;
    let timesUpTimeout = null;
    let elMode     = null;
    let elFocusIn  = null;
    let elBreakIn  = null;
    let elSaveBtn  = null;

    /** Duration (in seconds) of the current mode. */
    function modeSeconds() {
      return (timerState.mode === 'focus'
        ? timerState.focusMinutes
        : timerState.breakMinutes) * 60;
    }

    function renderMode() {
      if (!elMode) return;
      elMode.textContent = timerState.mode === 'focus' ? 'Focus' : 'Break';
      elMode.dataset.mode = timerState.mode;
    }

    /** Valid whole number within [min, max]? */
    function validMinutes(n, min, max) {
      return Number.isInteger(n) && n >= min && n <= max;
    }

    /**
     * Convert a non-negative integer number of seconds into a "MM:SS" string.
     * @param {number} s — total seconds (0–1500)
     * @returns {string}
     */
    function formatCountdown(s) {
      const totalSec = Math.max(0, Math.floor(s));
      const minutes  = Math.floor(totalSec / 60);
      const seconds  = totalSec % 60;
      return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    /**
     * Refresh the timer display element from timerState.totalSeconds.
     */
    function renderDisplay() {
      if (elDisplay) {
        elDisplay.textContent = formatCountdown(timerState.totalSeconds);
      }
    }

    /**
     * Apply the correct enabled/disabled state to each button based on
     * whether the timer is currently running.
     *
     * Button state matrix:
     *   Idle/Paused/Expired → Start: enabled,  Stop: disabled, Reset: enabled
     *   Running             → Start: disabled, Stop: enabled,  Reset: enabled
     */
    function updateButtonStates() {
      if (!elStart || !elStop || !elReset) return;

      const running = timerState.isRunning;
      elStart.disabled = running;
      elStop.disabled  = !running;
      elReset.disabled = false;

      // Sync aria-disabled to match the HTML disabled attribute for SR clarity
      elStart.setAttribute('aria-disabled', String(running));
      elStop.setAttribute('aria-disabled',  String(!running));
    }

    /**
     * Show "Time's up!" in the message element and automatically hide it
     * after 5 seconds (Requirement 2.5).
     */
    function showMessage(text) {
      if (!elMessage) return;

      // Cancel any previous auto-hide timer
      if (timesUpTimeout !== null) {
        clearTimeout(timesUpTimeout);
        timesUpTimeout = null;
      }

      elMessage.textContent = text;
      elMessage.removeAttribute('hidden');

      timesUpTimeout = setTimeout(function () {
        elMessage.setAttribute('hidden', '');
        timesUpTimeout = null;
      }, 5000);
    }

    /**
     * Decrement the counter by one second.  Stops and shows the "Time's up!"
     * message when the counter reaches zero.
     */
    function tick() {
      timerState.totalSeconds = Math.max(0, timerState.totalSeconds - 1);

      if (timerState.totalSeconds <= 0) {
        stop();
        // Switch to the other mode and wait for the user to press Start
        const wasFocus = timerState.mode === 'focus';
        timerState.mode = wasFocus ? 'break' : 'focus';
        timerState.totalSeconds = modeSeconds();
        renderMode();
        renderDisplay();
        showMessage(wasFocus
          ? "Time's up! Take a break."
          : "Break over! Ready to focus.");
      } else {
        renderDisplay();
      }
    }

    /**
     * Begin (or resume) the countdown.  No-op if the timer is already running.
     * Requirement 2.2, 2.6
     */
    function start() {
      if (timerState.isRunning) return;

      timerState.isRunning  = true;
      timerState.intervalId = setInterval(tick, 1000);
      updateButtonStates();
    }

    /**
     * Pause the countdown, retaining the remaining time.
     * Requirement 2.3, 2.7
     */
    function stop() {
      if (timerState.intervalId !== null) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
      }
      timerState.isRunning = false;
      updateButtonStates();
    }

    /**
     * Stop any active countdown and reset to the full duration of the current mode.
     * Requirement 2.4
     */
    function reset() {
      stop();

      // Also hide any visible "Time's up!" message
      if (timesUpTimeout !== null) {
        clearTimeout(timesUpTimeout);
        timesUpTimeout = null;
      }
      if (elMessage) {
        elMessage.setAttribute('hidden', '');
      }

      timerState.totalSeconds = modeSeconds();
      renderDisplay();
    }

    /**
     * Validate and apply the Focus / Break minutes from the settings inputs,
     * persist them, and restart the timer in Focus mode.
     */
    function saveSettings() {
      const focus = Number(elFocusIn.value);
      const rest  = Number(elBreakIn.value);

      if (!validMinutes(focus, LIMITS.focus.min, LIMITS.focus.max) ||
          !validMinutes(rest,  LIMITS.rest.min,  LIMITS.rest.max)) {
        showMessage('Focus must be 1–120 minutes and break 1–60 minutes.');
        return;
      }

      timerState.focusMinutes = focus;
      timerState.breakMinutes = rest;
      StorageManager.writeValue(StorageManager.FOCUS_KEY, focus);
      StorageManager.writeValue(StorageManager.BREAK_KEY, rest);

      stop();
      timerState.mode = 'focus';
      renderMode();
      reset();
      showMessage('Timer settings saved!');
    }

    /**
     * Bootstrap the widget: cache DOM refs, render initial state, attach
     * click listeners.
     * Requirement 2.1
     */
    function init() {
      elDisplay = document.getElementById('timer-display');
      elMessage = document.getElementById('timer-message');
      elStart   = document.getElementById('timer-start');
      elStop    = document.getElementById('timer-stop');
      elReset   = document.getElementById('timer-reset');
      elMode    = document.getElementById('timer-mode');
      elFocusIn = document.getElementById('focus-time');
      elBreakIn = document.getElementById('break-time');
      elSaveBtn = document.getElementById('save-pomodoro');

      // Load saved durations (fall back to 25 / 5 if missing or invalid)
      const f = Number(StorageManager.readValue(StorageManager.FOCUS_KEY, 25));
      const b = Number(StorageManager.readValue(StorageManager.BREAK_KEY, 5));
      timerState.focusMinutes = validMinutes(f, LIMITS.focus.min, LIMITS.focus.max) ? f : 25;
      timerState.breakMinutes = validMinutes(b, LIMITS.rest.min,  LIMITS.rest.max)  ? b : 5;
      if (elFocusIn) elFocusIn.value = timerState.focusMinutes;
      if (elBreakIn) elBreakIn.value = timerState.breakMinutes;

      timerState.mode = 'focus';
      timerState.totalSeconds = modeSeconds();
      if (elSaveBtn) elSaveBtn.addEventListener('click', saveSettings);

      // Render initial time and correct button states
      renderMode();
      renderDisplay();
      updateButtonStates();

      if (elStart) elStart.addEventListener('click', start);
      if (elStop)  elStop.addEventListener('click',  stop);
      if (elReset) elReset.addEventListener('click', reset);
    }

    // Expose init and formatCountdown (formatCountdown is needed by property tests)
    return { init, formatCountdown };
  })();

  /* =========================================================================
   * TODO LIST WIDGET
   * Owns #todo-section.  Manages an in-memory array of Task objects, renders
   * them, and persists to StorageManager on every mutation.
   * ========================================================================= */

  const TodoListWidget = (function () {

    /* -----------------------------------------------------------------------
     * In-memory state
     * --------------------------------------------------------------------- */

    /** @type {Array<{id:string, text:string, completed:boolean, createdAt:number}>} */
    let tasks = [];

    /** @type {string|null} ID of the task currently in edit mode, or null */
    let editingId = null;

    /* -----------------------------------------------------------------------
     * DOM references — populated in init()
     * --------------------------------------------------------------------- */
    let elForm      = null;   // #todo-form
    let elInput     = null;   // #todo-input
    let elError     = null;   // #todo-input-error
    let elList      = null;   // #todo-list

    /* -----------------------------------------------------------------------
     * Helper: generate a unique ID
     * Uses crypto.randomUUID() when available, falls back to Date.now()
     * --------------------------------------------------------------------- */
    function generateId() {
      if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
      ) {
        return crypto.randomUUID();
      }
      return Date.now().toString() + Math.random().toString(36).slice(2);
    }

    /* -----------------------------------------------------------------------
     * Helper: show / hide the inline validation message
     * --------------------------------------------------------------------- */
    function showError(message) {
      if (!elError) return;
      elError.textContent = message;
      elError.removeAttribute('hidden');
    }

    function clearError() {
      if (!elError) return;
      elError.textContent = '';
      elError.setAttribute('hidden', '');
    }

    /* -----------------------------------------------------------------------
     * persist() — serialise tasks[] to StorageManager
     * Requirement 3.3, 3.5, 3.7, 3.10
     * --------------------------------------------------------------------- */
    function persist() {
      StorageManager.write(StorageManager.TASKS_KEY, tasks);
    }

    /* -----------------------------------------------------------------------
     * addTask(description) — Requirement 3.1, 3.2, 3.3
     * --------------------------------------------------------------------- */
    function addTask(description) {
      const trimmed = (description || '').trim();

      if (trimmed.length === 0) {
        showError('Task description cannot be empty.');
        if (elInput) elInput.focus();
        return;
      }

      if (trimmed.length > 500) {
        showError('Task description must be 500 characters or fewer.');
        if (elInput) elInput.focus();
        return;
      }

      clearError();

      const task = {
        id:        generateId(),
        text:      trimmed,
        completed: false,
        createdAt: Date.now(),
      };

      tasks.push(task);
      persist();
      render();

      // Clear the input field and return focus (Requirement 3.1)
      if (elInput) {
        elInput.value = '';
        elInput.focus();
      }
    }

    /* -----------------------------------------------------------------------
     * toggleComplete(id) — Requirement 3.5
     * --------------------------------------------------------------------- */
    function toggleComplete(id) {
      const task = tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.completed = !task.completed;
      persist();
      render();
    }

    /* -----------------------------------------------------------------------
     * startEdit(id) — Requirement 3.6
     * --------------------------------------------------------------------- */
    function startEdit(id) {
      editingId = id;
      render();
    }

    /* -----------------------------------------------------------------------
     * confirmEdit(id, newText) — Requirement 3.7, 3.8
     * --------------------------------------------------------------------- */
    function confirmEdit(id, newText) {
      const trimmed = (newText || '').trim();

      if (trimmed.length === 0) {
        // Empty edit → silently discard and exit edit mode (Requirement 3.8)
        cancelEdit();
        return;
      }

      const task = tasks.find(function (t) { return t.id === id; });
      if (task) {
        task.text = trimmed;
        persist();
      }
      editingId = null;
      render();
    }

    /* -----------------------------------------------------------------------
     * cancelEdit() — Requirement 3.9
     * Discards unsaved changes and exits edit mode.
     * --------------------------------------------------------------------- */
    function cancelEdit() {
      editingId = null;
      render();
    }

    /* -----------------------------------------------------------------------
     * deleteTask(id) — Requirement 3.10
     * --------------------------------------------------------------------- */
    function deleteTask(id) {
      tasks = tasks.filter(function (t) { return t.id !== id; });
      persist();
      render();
    }

    /* -----------------------------------------------------------------------
     * render() — Requirement 3.4
     * Rebuilds #todo-list entirely from tasks[] and editingId.
     * --------------------------------------------------------------------- */
    function render() {
      if (!elList) return;

      // Clear existing list items
      elList.innerHTML = '';

      if (tasks.length === 0) {
        // Requirement 3.12: empty state — render empty list with no error
        return;
      }

      tasks.forEach(function (task) {
        const li = document.createElement('li');
        li.className = 'todo-item' + (task.completed ? ' todo-item--completed' : '');
        li.setAttribute('role', 'listitem');
        li.dataset.id = task.id;

        if (editingId === task.id) {
          // ---------------------------------------------------------------
          // Edit mode: show an inline editable input (Requirement 3.6)
          // ---------------------------------------------------------------
          const editInput = document.createElement('input');
          editInput.type = 'text';
          editInput.className = 'todo-item__edit-input';
          editInput.value = task.text;
          editInput.maxLength = 500;
          editInput.setAttribute('aria-label', 'Edit task: ' + task.text);

          // Confirm on Enter, cancel on Escape (Requirement 3.9)
          editInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmEdit(task.id, editInput.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          });

          // Confirm on blur as well (saves UX friction)
          editInput.addEventListener('blur', function () {
            // Only confirm if we are still in edit mode for this task
            if (editingId === task.id) {
              confirmEdit(task.id, editInput.value);
            }
          });

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'btn btn--icon';
          saveBtn.setAttribute('aria-label', 'Save edit');
          saveBtn.textContent = '✓';
          saveBtn.addEventListener('click', function () {
            confirmEdit(task.id, editInput.value);
          });

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'btn btn--icon';
          cancelBtn.setAttribute('aria-label', 'Cancel edit');
          cancelBtn.textContent = '✕';
          cancelBtn.addEventListener('click', function (e) {
            e.preventDefault();
            cancelEdit();
          });

          li.appendChild(editInput);
          li.appendChild(saveBtn);
          li.appendChild(cancelBtn);

          // Auto-focus the edit input and select all text
          // (deferred so the element is in the DOM first)
          setTimeout(function () { editInput.focus(); editInput.select(); }, 0);

        } else {
          // ---------------------------------------------------------------
          // Normal (read) mode (Requirement 3.4)
          // ---------------------------------------------------------------

          // Completion toggle checkbox
          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.className = 'todo-item__toggle';
          toggle.checked = task.completed;
          toggle.setAttribute('aria-label',
            (task.completed ? 'Mark incomplete: ' : 'Mark complete: ') + task.text
          );
          toggle.addEventListener('change', function () {
            toggleComplete(task.id);
          });

          // Task text span
          const textSpan = document.createElement('span');
          textSpan.className = 'todo-item__text';
          textSpan.textContent = task.text;

          // Action buttons container
          const actions = document.createElement('div');
          actions.className = 'todo-item__actions';

          // Edit button
          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn btn--icon';
          editBtn.setAttribute('aria-label', 'Edit task: ' + task.text);
          editBtn.textContent = '✏️';
          editBtn.addEventListener('click', function () {
            startEdit(task.id);
          });

          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'btn btn--icon btn--danger';
          deleteBtn.setAttribute('aria-label', 'Delete task: ' + task.text);
          deleteBtn.textContent = '🗑️';
          deleteBtn.addEventListener('click', function () {
            deleteTask(task.id);
          });

          actions.appendChild(editBtn);
          actions.appendChild(deleteBtn);

          li.appendChild(toggle);
          li.appendChild(textSpan);
          li.appendChild(actions);
        }

        elList.appendChild(li);
      });
    }

    /* -----------------------------------------------------------------------
     * init() — Requirement 3.11, 3.12, 3.13
     * --------------------------------------------------------------------- */
    function init() {
      elForm  = document.getElementById('todo-form');
      elInput = document.getElementById('todo-input');
      elError = document.getElementById('todo-input-error');
      elList  = document.getElementById('todo-list');

      // Load persisted tasks (Requirement 3.11)
      tasks = StorageManager.read(StorageManager.TASKS_KEY);

      // Render whatever was loaded (may be empty — Requirement 3.12)
      render();

      // Wire up the "Add task" form submission
      if (elForm) {
        elForm.addEventListener('submit', function (e) {
          e.preventDefault();
          addTask(elInput ? elInput.value : '');
        });
      }
    }

    // Public API
    // Pure functions (addTask, toggleComplete, etc.) are also exposed so the
    // property-based tests can exercise them directly without a DOM.
    return {
      init,
      // Exposed for property-based tests:
      addTask,
      toggleComplete,
      deleteTask,
      confirmEdit,
      cancelEdit,
      startEdit,
      // Expose state accessors for tests
      getTasks: function () { return tasks; },
      setTasks: function (arr) { tasks = arr; },
      getEditingId: function () { return editingId; },
    };
  })();

  /* =========================================================================
   * QUICK LINKS WIDGET
   * Owns #links-section.  Manages a persisted array of Link objects.
   * Each link is { id, label, url } and is rendered as an <a target="_blank">
   * with a delete button alongside it.
   * Max 20 links enforced; URL must start with http:// or https://.
   * ========================================================================= */

  const QuickLinksWidget = (function () {
    /** @type {Array<{id: string, label: string, url: string}>} */
    let links = [];

    // Cached DOM references — set in init()
    let elForm       = null;
    let elLabelInput = null;
    let elUrlInput   = null;
    let elFormError  = null;
    let elGrid       = null;

    const MAX_LINKS      = 20;
    const MAX_LABEL_LEN  = 50;
    const MAX_URL_LEN    = 2048;

    /**
     * Generate a unique id.
     * Uses crypto.randomUUID() when available; falls back to Date.now() + random.
     * @returns {string}
     */
    function generateId() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }

    /**
     * Return true iff url starts with "http://" or "https://" (case-sensitive).
     * @param {string} url
     * @returns {boolean}
     */
    function validateUrl(url) {
      return url.startsWith('http://') || url.startsWith('https://');
    }

    /**
     * Show an inline validation message inside the form error paragraph.
     * @param {string} message
     */
    function showFormError(message) {
      if (!elFormError) return;
      elFormError.textContent = message;
      elFormError.removeAttribute('hidden');
    }

    /**
     * Clear any visible form validation message.
     */
    function clearFormError() {
      if (!elFormError) return;
      elFormError.textContent = '';
      elFormError.setAttribute('hidden', '');
    }

    /**
     * Persist the current links array to StorageManager.
     * @returns {boolean}
     */
    function persist() {
      return StorageManager.write(StorageManager.LINKS_KEY, links);
    }

    /**
     * Rebuild the #links-grid from the current in-memory links array.
     * Each entry renders as:
     *   <div role="listitem" class="link-btn-wrapper">
     *     <a class="link-btn" href="..." target="_blank" rel="noopener noreferrer">Label</a>
     *     <button class="btn btn--danger" aria-label="Delete …">✕</button>
     *   </div>
     */
    function render() {
      if (!elGrid) return;

      // Clear existing children
      elGrid.innerHTML = '';

      if (links.length === 0) {
        // Empty state — no error, just an empty panel (Requirement 4.11)
        return;
      }

      links.forEach(function (link) {
        var wrapper = document.createElement('div');
        wrapper.className = 'link-btn-wrapper';
        wrapper.setAttribute('role', 'listitem');

        // The clickable link — opens in new tab (Requirement 4.5)
        var anchor = document.createElement('a');
        anchor.className     = 'link-btn';
        anchor.href          = link.url;
        anchor.target        = '_blank';
        anchor.rel           = 'noopener noreferrer';
        anchor.textContent   = link.label;
        anchor.title         = link.url;
        anchor.setAttribute('aria-label', link.label + ' (opens in new tab)');

        // Delete control (Requirement 4.6)
        var delBtn = document.createElement('button');
        delBtn.type          = 'button';
        delBtn.className     = 'btn btn--danger btn--icon';
        delBtn.textContent   = '✕';
        delBtn.setAttribute('aria-label', 'Delete link: ' + link.label);

        // Capture link.id for the closure
        (function (id) {
          delBtn.addEventListener('click', function () {
            deleteLink(id);
          });
        }(link.id));

        wrapper.appendChild(anchor);
        wrapper.appendChild(delBtn);
        elGrid.appendChild(wrapper);
      });
    }

    /**
     * Validate inputs and add a new link.
     * Displays inline error messages for invalid submissions.
     * Enforces the 20-link cap.
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.10
     *
     * @param {string} rawLabel
     * @param {string} rawUrl
     */
    function addLink(rawLabel, rawUrl) {
      clearFormError();

      var label = rawLabel.trim();
      var url   = rawUrl.trim();

      // Validate label presence
      if (label.length === 0) {
        showFormError('Please enter a label for the link.');
        if (elLabelInput) elLabelInput.focus();
        return;
      }

      // Validate label length (enforced by maxlength attribute too, but belt-and-suspenders)
      if (label.length > MAX_LABEL_LEN) {
        showFormError('Label must be 50 characters or fewer.');
        if (elLabelInput) elLabelInput.focus();
        return;
      }

      // Validate URL presence
      if (url.length === 0) {
        showFormError('Please enter a URL for the link.');
        if (elUrlInput) elUrlInput.focus();
        return;
      }

      // Validate URL length
      if (url.length > MAX_URL_LEN) {
        showFormError('URL must be 2048 characters or fewer.');
        if (elUrlInput) elUrlInput.focus();
        return;
      }

      // Validate URL scheme
      if (!validateUrl(url)) {
        showFormError('URL must start with "http://" or "https://".');
        if (elUrlInput) elUrlInput.focus();
        return;
      }

      // Enforce 20-link cap (Requirement 4.10)
      if (links.length >= MAX_LINKS) {
        showFormError('You have reached the maximum of 20 links. Delete a link to add a new one.');
        return;
      }

      // All validations passed — create the link
      var newLink = {
        id:    generateId(),
        label: label,
        url:   url,
      };

      links.push(newLink);
      persist();
      render();

      // Clear the form inputs after a successful add
      if (elLabelInput) elLabelInput.value = '';
      if (elUrlInput)   elUrlInput.value   = '';
      if (elLabelInput) elLabelInput.focus();
    }

    /**
     * Remove a link by id, persist, and re-render.
     * Requirement: 4.6
     *
     * @param {string} id
     */
    function deleteLink(id) {
      links = links.filter(function (link) { return link.id !== id; });
      persist();
      render();
    }

    /**
     * Handle form submission: read inputs and delegate to addLink().
     * @param {Event} e
     */
    function handleFormSubmit(e) {
      e.preventDefault();
      var label = elLabelInput ? elLabelInput.value : '';
      var url   = elUrlInput   ? elUrlInput.value   : '';
      addLink(label, url);
    }

    /**
     * Initialise the widget.
     * Reads persisted links, renders them, then attaches the form listener.
     * Requirements: 4.7, 4.8, 4.11
     */
    function init() {
      elForm       = document.getElementById('links-form');
      elLabelInput = document.getElementById('link-label-input');
      elUrlInput   = document.getElementById('link-url-input');
      elFormError  = document.getElementById('links-form-error');
      elGrid       = document.getElementById('links-grid');

      // Read persisted links; StorageManager handles errors and returns []
      links = StorageManager.read(StorageManager.LINKS_KEY);

      // Render whatever was loaded (empty panel or saved links)
      render();

      // Wire up the add-link form
      if (elForm) {
        elForm.addEventListener('submit', handleFormSubmit);
      }
    }

    // Public API
    // validateUrl is exposed for property-based testing (Property 9)
    return {
      init,
      validateUrl,
    };
  })();

  /* =========================================================================
   * APP CORE
   * Orchestrates widget initialisation after DOMContentLoaded.
   * Each widget init() is wrapped in try/catch; on failure a placeholder <div>
   * with class "widget-error" is inserted so the layout does not collapse
   * (Requirement 6.8).
   * ========================================================================= */

  const AppCore = (function () {
    /**
     * Minimum height applied to the error placeholder so the grid cell keeps
     * its space even when a widget fails to render.
     */
    const PLACEHOLDER_MIN_HEIGHT = '200px';

    /**
     * Attempt to initialise a single widget.  On failure, find the widget's
     * section element (by id) and replace its content with a placeholder div.
     *
     * @param {string}   widgetName  — human-readable name for error messages
     * @param {string}   sectionId   — id of the <section> the widget owns
     * @param {Function} initFn      — the widget's init() function
     */
    function initWidget(widgetName, sectionId, initFn) {
      try {
        initFn();
      } catch (err) {
        console.error('[AppCore] ' + widgetName + ' failed to initialise:', err);

        const section = document.getElementById(sectionId);
        if (section) {
          // Clear whatever partial content was rendered
          section.innerHTML = '';

          // Insert a placeholder that preserves grid layout
          const placeholder = document.createElement('div');
          placeholder.className = 'widget-error';
          placeholder.style.minHeight = PLACEHOLDER_MIN_HEIGHT;
          placeholder.setAttribute('role', 'alert');
          placeholder.setAttribute('aria-live', 'polite');
          placeholder.textContent =
            widgetName + ' could not be loaded. Please refresh the page.';

          section.appendChild(placeholder);
        }
      }
    }

    /**
     * Wire up the dismiss button on the global storage warning banner.
     * Matches id="warning-banner" and id="warning-banner-dismiss" in index.html.
     * Visibility is toggled via the "warning-banner--hidden" CSS class.
     */
    function initWarningBanner() {
      const banner = document.getElementById('warning-banner');
      if (!banner) return;

      const dismissBtn = document.getElementById('warning-banner-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          banner.classList.add('warning-banner--hidden');
        });
      }
    }

    /**
     * Light / Dark mode toggle. Preference is persisted via StorageManager.
     */
    function initTheme() {
      const themeToggle = document.getElementById('theme-toggle');
      if (!themeToggle) return;

      function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        const isDark = theme === 'dark';
        themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        themeToggle.setAttribute('aria-pressed', String(isDark));
        StorageManager.writeValue(StorageManager.THEME_KEY, theme);
      }

      const saved = StorageManager.readValue(StorageManager.THEME_KEY, 'light');
      applyTheme(saved === 'dark' ? 'dark' : 'light');

      themeToggle.addEventListener('click', function () {
        const current = document.documentElement.dataset.theme || 'light';
        applyTheme(current === 'light' ? 'dark' : 'light');
      });
    }

    /**
     * Main entry point.  Called once DOMContentLoaded fires.
     * Requirement 5.6: reads storage and renders all widgets before
     * any content is shown.
     */
    function init() {
      initWarningBanner();
      initTheme();

      // Widgets are initialised in the order specified by the design document.
      // StorageManager needs no async setup so no explicit init call is needed.
      initWidget('GreetingWidget',   'greeting-section', GreetingWidget.init);
      initWidget('FocusTimerWidget', 'timer-section',    FocusTimerWidget.init);
      initWidget('TodoListWidget',   'todo-section',     TodoListWidget.init);
      initWidget('QuickLinksWidget', 'links-section',    QuickLinksWidget.init);
    }

    return { init };
  })();

  /* =========================================================================
   * BOOT
   * ========================================================================= */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AppCore.init);
  } else {
    // DOMContentLoaded already fired (e.g. script loaded with defer)
    AppCore.init();
  }

})();
