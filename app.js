(function () {
  "use strict";

  var APP_VERSION = 1;
  var STORAGE_KEY = "little-reset-data-v1";
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var TABS = [
    { id: "today", label: "Today", icon: "🌤️" },
    { id: "rooms", label: "Rooms", icon: "🏠" },
    { id: "tasks", label: "Tasks", icon: "✅" },
    { id: "review", label: "Review", icon: "📊" },
    { id: "settings", label: "Settings", icon: "⚙️" }
  ];
  var FREQUENCIES = [
    { value: "daily", label: "Daily" },
    { value: "every-days", label: "Every X days" },
    { value: "weekly", label: "Weekly" },
    { value: "every-weeks", label: "Every X weeks" },
    { value: "monthly", label: "Monthly" },
    { value: "every-months", label: "Every X months" },
    { value: "weekdays", label: "Specific weekdays" },
    { value: "seasonal", label: "Seasonal / paused" },
    { value: "one-time", label: "One-time" },
    { value: "as-needed", label: "As needed" }
  ];
  var EFFORTS = ["low", "medium", "high"];
  var PRIORITIES = ["low", "normal", "high"];
  var TASK_TYPES = [
    { value: "reset", label: "Reset task" },
    { value: "maintenance", label: "Maintenance task" },
    { value: "deep-clean", label: "Deep clean task" }
  ];
  var WEEKDAYS = [
    { value: 0, short: "Sun", label: "Sunday" },
    { value: 1, short: "Mon", label: "Monday" },
    { value: 2, short: "Tue", label: "Tuesday" },
    { value: 3, short: "Wed", label: "Wednesday" },
    { value: 4, short: "Thu", label: "Thursday" },
    { value: 5, short: "Fri", label: "Friday" },
    { value: 6, short: "Sat", label: "Saturday" }
  ];

  var app = document.getElementById("app");
  var modalRoot = document.getElementById("modal-root");
  var toastEl = document.getElementById("toast");
  var state = null;
  var toastTimer = null;
  var ui = {
    tab: "today",
    selectedRoomId: null,
    oneThingId: null,
    reviewRange: 7,
    selectedTaskIds: new Set(),
    visibleTaskIds: [],
    filters: {
      search: "",
      room: "all",
      due: "all",
      effort: "all",
      priority: "all",
      frequency: "all",
      tag: "all",
      sort: "due-soon"
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    state = loadState();
    applySettings();
    render();
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("change", handleChange);
    document.addEventListener("input", handleInput);
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSampleState();
      return migrateState(JSON.parse(raw));
    } catch (error) {
      console.warn("Little Reset could not load saved data.", error);
      return createSampleState();
    }
  }

  function saveState() {
    state.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function migrateState(data) {
    if (!data || typeof data !== "object") return createSampleState();
    if (!data.version) data.version = 1;
    data.meta = Object.assign({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, data.meta || {});
    data.settings = Object.assign(defaultSettings(), data.settings || {});
    data.rooms = Array.isArray(data.rooms) ? data.rooms.map(normalizeRoom) : createSampleState().rooms;
    data.tasks = Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : createSampleState().tasks;
    data.history = Array.isArray(data.history) ? data.history : [];
    data.templates = data.templates && typeof data.templates === "object" ? data.templates : defaultTemplates();
    data.templates.rooms = Array.isArray(data.templates.rooms) ? data.templates.rooms : defaultTemplates().rooms;
    data.templates.tasks = Array.isArray(data.templates.tasks) ? data.templates.tasks.map(normalizeTemplate) : defaultTemplates().tasks;
    data.version = APP_VERSION;
    return data;
  }

  function defaultSettings() {
    return {
      theme: "cozy-neutral",
      accentColor: "#8d7661",
      compactMode: false,
      defaultFrequencyType: "weekly",
      defaultFrequencyInterval: 1,
      defaultEffort: "low",
      defaultEstimatedMinutes: 10,
      energyMode: "normal",
      reflectionNotes: ""
    };
  }

  function normalizeRoom(room, index) {
    return Object.assign({
      id: makeId("room"),
      name: "Room",
      icon: "🏠",
      color: "#d9c9b7",
      sortOrder: index || 0,
      notes: "",
      archived: false
    }, room || {});
  }

  function normalizeTask(task) {
    var clean = Object.assign({
      id: makeId("task"),
      roomId: "whole-home",
      title: "Untitled task",
      description: "",
      frequencyType: "weekly",
      frequencyInterval: 1,
      weekdays: [],
      nextDueDate: todayKey(),
      estimatedMinutes: 10,
      effort: "low",
      priority: "normal",
      status: "active",
      lastCompletedDate: null,
      completionHistory: [],
      snoozeDate: null,
      seasonalPaused: false,
      tags: [],
      taskType: "maintenance"
    }, task || {});
    clean.frequencyInterval = Math.max(1, Number(clean.frequencyInterval) || 1);
    clean.estimatedMinutes = Math.max(1, Number(clean.estimatedMinutes) || 10);
    clean.weekdays = Array.isArray(clean.weekdays) ? clean.weekdays.map(Number).filter(function (day) { return day >= 0 && day <= 6; }) : [];
    clean.tags = Array.isArray(clean.tags) ? clean.tags : splitTags(clean.tags || "");
    clean.completionHistory = Array.isArray(clean.completionHistory) ? clean.completionHistory : [];
    return clean;
  }

  function normalizeTemplate(template) {
    return Object.assign({
      id: makeId("template"),
      suggestedRoomName: "Whole Home",
      title: "New task template",
      description: "",
      frequencyType: "weekly",
      frequencyInterval: 1,
      estimatedMinutes: 10,
      effort: "low",
      priority: "normal",
      taskType: "maintenance",
      tags: []
    }, template || {});
  }

  function defaultTemplates() {
    return {
      rooms: [
        { name: "Bedroom", icon: "🛏️", color: "#cdd9c8" },
        { name: "Bathroom", icon: "🛁", color: "#c8d7df" },
        { name: "Kitchen", icon: "🍳", color: "#ead1b7" },
        { name: "Living Room", icon: "🛋️", color: "#dcc8d0" },
        { name: "Office", icon: "🖥️", color: "#d7d0c5" },
        { name: "Laundry", icon: "🧺", color: "#d6d9e8" },
        { name: "Entryway", icon: "🚪", color: "#e4d7bf" },
        { name: "Whole Home", icon: "✨", color: "#d9c9b7" }
      ],
      tasks: [
        templateSeed("Kitchen", "Wipe counters", "Clear crumbs and sticky spots.", "daily", 1, 5, "low", "normal", "reset", ["quick", "surface"]),
        templateSeed("Kitchen", "Dishes reset", "Load or wash the dishes that are ready.", "daily", 1, 10, "medium", "high", "reset", ["daily"]),
        templateSeed("Kitchen", "Sweep floor", "Quick sweep in the kitchen path.", "every-days", 2, 8, "low", "normal", "maintenance", ["floor"]),
        templateSeed("Kitchen", "Clean sink", "Scrub the basin and rinse the drain area.", "weekly", 1, 8, "low", "normal", "maintenance", ["sink"]),
        templateSeed("Kitchen", "Clear old fridge food", "Check leftovers and expired items.", "weekly", 1, 12, "medium", "normal", "maintenance", ["fridge"]),
        templateSeed("Kitchen", "Wipe microwave", "Clean the inside plate and door.", "monthly", 1, 10, "low", "normal", "maintenance", ["appliance"]),
        templateSeed("Kitchen", "Mop floor", "Mop kitchen traffic areas.", "weekly", 1, 18, "medium", "normal", "deep-clean", ["floor"]),
        templateSeed("Bathroom", "Wipe sink/counter", "Quick wipe around the sink and counter.", "every-days", 2, 6, "low", "normal", "reset", ["quick", "sink"]),
        templateSeed("Bathroom", "Clean toilet", "Clean bowl, seat, and outside touch points.", "weekly", 1, 12, "medium", "high", "maintenance", ["bathroom"]),
        templateSeed("Bathroom", "Clean mirror", "Remove spots and streaks.", "weekly", 1, 5, "low", "normal", "maintenance", ["quick"]),
        templateSeed("Bathroom", "Replace towels", "Swap towels and move used ones to laundry.", "weekly", 1, 5, "low", "normal", "reset", ["laundry"]),
        templateSeed("Bathroom", "Scrub shower", "Scrub walls, tub, and fixtures.", "every-weeks", 2, 25, "high", "normal", "deep-clean", ["deep"]),
        templateSeed("Bedroom", "Make bed", "A simple reset for the room.", "daily", 1, 3, "low", "normal", "reset", ["quick"]),
        templateSeed("Bedroom", "Clothes reset", "Put away or hamper loose clothes.", "every-days", 2, 10, "low", "normal", "reset", ["laundry"]),
        templateSeed("Bedroom", "Clear nightstand", "Return cups, wrappers, and extras.", "weekly", 1, 7, "low", "normal", "maintenance", ["surface"]),
        templateSeed("Bedroom", "Vacuum floor", "Vacuum the open floor area.", "weekly", 1, 15, "medium", "normal", "maintenance", ["floor"]),
        templateSeed("Whole Home", "Trash reset", "Empty small bins and gather trash.", "weekly", 1, 10, "low", "high", "reset", ["quick"]),
        templateSeed("Whole Home", "10-minute tidy", "Pick one visible surface or path.", "daily", 1, 10, "low", "normal", "reset", ["quick"]),
        templateSeed("Whole Home", "Vacuum high traffic areas", "Focus on the paths people actually use.", "every-days", 3, 15, "medium", "normal", "maintenance", ["floor"]),
        templateSeed("Whole Home", "Reset surfaces", "Clear a few flat surfaces without perfecting everything.", "daily", 1, 10, "low", "normal", "reset", ["surface"])
      ]
    };
  }

  function templateSeed(room, title, description, frequencyType, interval, minutes, effort, priority, taskType, tags) {
    return {
      id: "template-" + slugify(room + "-" + title),
      suggestedRoomName: room,
      title: title,
      description: description,
      frequencyType: frequencyType,
      frequencyInterval: interval,
      estimatedMinutes: minutes,
      effort: effort,
      priority: priority,
      taskType: taskType,
      tags: tags
    };
  }

  function createSampleState() {
    var createdAt = new Date().toISOString();
    var rooms = [
      roomSeed("kitchen", "Kitchen", "🍳", "#ead1b7", 1, "The daily landing zone."),
      roomSeed("bathroom", "Bathroom", "🛁", "#c8d7df", 2, "Small wipes help a lot."),
      roomSeed("bedroom", "Bedroom", "🛏️", "#cdd9c8", 3, "Rest first, polish later."),
      roomSeed("living-room", "Living Room", "🛋️", "#dcc8d0", 4, "Keep the reset easy to notice."),
      roomSeed("office", "Office", "🖥️", "#d7d0c5", 5, "Clear enough to start."),
      roomSeed("laundry", "Laundry", "🧺", "#d6d9e8", 6, "One load still counts."),
      roomSeed("entryway", "Entryway", "🚪", "#e4d7bf", 7, "A small welcome-home reset."),
      roomSeed("whole-home", "Whole Home", "✨", "#d9c9b7", 8, "Tiny tasks that help everywhere.")
    ];
    var tasks = [
      taskSeed("task-kitchen-counters", "kitchen", "Wipe counters", "Clear crumbs and sticky spots.", "daily", 1, 0, 5, "low", "normal", "reset", ["quick", "surface"]),
      taskSeed("task-kitchen-dishes", "kitchen", "Dishes reset", "Load or wash what is ready. Stop when the sink feels usable.", "daily", 1, 0, 10, "medium", "high", "reset", ["daily"]),
      taskSeed("task-kitchen-sweep", "kitchen", "Sweep floor", "Quick sweep around the counters and table.", "every-days", 2, -1, 8, "low", "normal", "maintenance", ["quick", "floor"]),
      taskSeed("task-kitchen-sink", "kitchen", "Clean sink", "Scrub the basin and rinse the drain area.", "weekly", 1, 2, 8, "low", "normal", "maintenance", ["sink"]),
      taskSeed("task-kitchen-fridge", "kitchen", "Clear old fridge food", "Check leftovers and expired items.", "weekly", 1, 5, 12, "medium", "normal", "maintenance", ["fridge"]),
      taskSeed("task-bathroom-sink", "bathroom", "Wipe sink/counter", "A quick wipe around the sink and faucet.", "every-days", 2, 0, 6, "low", "normal", "reset", ["quick", "sink"]),
      taskSeed("task-bathroom-toilet", "bathroom", "Clean toilet", "Clean bowl, seat, and outside touch points.", "weekly", 1, -3, 12, "medium", "high", "maintenance", ["bathroom"]),
      taskSeed("task-bathroom-mirror", "bathroom", "Clean mirror", "Remove spots and streaks.", "weekly", 1, 3, 5, "low", "normal", "maintenance", ["quick"]),
      taskSeed("task-bathroom-towels", "bathroom", "Replace towels", "Fresh towels and used ones to laundry.", "weekly", 1, 1, 5, "low", "normal", "reset", ["laundry", "quick"]),
      taskSeed("task-bathroom-shower", "bathroom", "Scrub shower", "Scrub tub, walls, and fixtures.", "every-weeks", 2, 6, 25, "high", "normal", "deep-clean", ["deep"]),
      taskSeed("task-bedroom-bed", "bedroom", "Make bed", "A simple reset for the room.", "daily", 1, 0, 3, "low", "normal", "reset", ["quick"]),
      taskSeed("task-bedroom-clothes", "bedroom", "Clothes reset", "Put away or hamper loose clothes.", "every-days", 3, -2, 10, "low", "normal", "reset", ["laundry"]),
      taskSeed("task-bedroom-nightstand", "bedroom", "Clear nightstand", "Return cups, wrappers, and extras.", "weekly", 1, 4, 7, "low", "normal", "maintenance", ["surface"]),
      taskSeed("task-bedroom-vacuum", "bedroom", "Vacuum floor", "Vacuum the open floor area.", "weekly", 1, 5, 15, "medium", "normal", "maintenance", ["floor"]),
      taskSeed("task-living-tidy", "living-room", "10-minute tidy", "Reset visible items without trying to finish the whole room.", "daily", 1, 0, 10, "low", "normal", "reset", ["quick"]),
      taskSeed("task-living-vacuum", "living-room", "Vacuum high traffic areas", "Focus on the paths people use most.", "every-days", 3, 1, 15, "medium", "normal", "maintenance", ["floor"]),
      taskSeed("task-office-desk", "office", "Desk reset", "Clear enough space to start work easily.", "weekly", 1, 0, 10, "low", "normal", "reset", ["surface"]),
      taskSeed("task-laundry-load", "laundry", "Start or switch one load", "Move laundry one step forward.", "as-needed", 1, null, 8, "low", "normal", "maintenance", ["laundry"]),
      taskSeed("task-entry-shoes", "entryway", "Entryway shoe reset", "Pair shoes and clear the walkway.", "weekly", 1, 6, 6, "low", "normal", "reset", ["quick"]),
      taskSeed("task-whole-trash", "whole-home", "Trash reset", "Empty small bins and gather trash.", "weekly", 1, -1, 10, "low", "high", "reset", ["quick"]),
      taskSeed("task-whole-surfaces", "whole-home", "Reset surfaces", "Clear a few flat surfaces. Good enough counts.", "daily", 1, 0, 10, "low", "normal", "reset", ["surface", "quick"])
    ];
    var history = [];
    addSampleCompletion(tasks, history, "task-bedroom-bed", -1);
    addSampleCompletion(tasks, history, "task-living-tidy", -1);
    addSampleCompletion(tasks, history, "task-kitchen-sink", -4);
    addSampleCompletion(tasks, history, "task-bathroom-mirror", -5);
    return {
      version: APP_VERSION,
      meta: { createdAt: createdAt, updatedAt: createdAt },
      rooms: rooms,
      tasks: tasks,
      history: history,
      settings: defaultSettings(),
      templates: defaultTemplates()
    };
  }

  function roomSeed(id, name, icon, color, sortOrder, notes) {
    return { id: id, name: name, icon: icon, color: color, sortOrder: sortOrder, notes: notes, archived: false };
  }

  function taskSeed(id, roomId, title, description, frequencyType, interval, dueOffset, minutes, effort, priority, taskType, tags) {
    return normalizeTask({
      id: id,
      roomId: roomId,
      title: title,
      description: description,
      frequencyType: frequencyType,
      frequencyInterval: interval,
      weekdays: [],
      nextDueDate: dueOffset === null ? null : offsetDate(dueOffset),
      estimatedMinutes: minutes,
      effort: effort,
      priority: priority,
      status: "active",
      lastCompletedDate: null,
      completionHistory: [],
      snoozeDate: null,
      seasonalPaused: frequencyType === "seasonal",
      tags: tags,
      taskType: taskType
    });
  }

  function addSampleCompletion(tasks, history, taskId, offset) {
    var task = tasks.find(function (item) { return item.id === taskId; });
    if (!task) return;
    var date = offsetDate(offset);
    task.lastCompletedDate = date;
    task.completionHistory.push({ date: date, note: "Sample completion" });
    history.push({
      id: makeId("history"),
      taskId: task.id,
      roomId: task.roomId,
      type: "completed",
      date: date + "T12:00:00.000Z",
      note: "Sample completion",
      dueDate: task.nextDueDate,
      nextDueDate: task.nextDueDate
    });
  }

  function render() {
    applySettings();
    app.innerHTML = renderTopbar() +
      "<div class=\"layout\">" +
      "<aside class=\"sidebar\" aria-label=\"Main navigation\">" + renderNav("side") + "</aside>" +
      "<section class=\"content\">" + renderActiveView() + "</section>" +
      "</div>" +
      "<nav class=\"bottom-nav\" aria-label=\"Main navigation\">" + renderNav("bottom") + "</nav>" +
      "<button class=\"fab primary\" type=\"button\" data-action=\"quick-add\" aria-label=\"Add task\">+</button>";
  }

  function renderTopbar() {
    var summary = getTodaySummaryText();
    return "<header class=\"topbar\">" +
      "<div class=\"brand\"><div class=\"brand-mark\">✨</div><div><h1>Little Reset</h1><p>" + escapeHtml(summary) + "</p></div></div>" +
      "<div class=\"header-actions\">" +
      "<button type=\"button\" data-action=\"quick-add\">＋ Task</button>" +
      "<button type=\"button\" data-action=\"add-room\">🏠 Room</button>" +
      "<button type=\"button\" data-action=\"export-data\">⬇ Backup</button>" +
      "</div>" +
      "</header>";
  }

  function renderNav(location) {
    return TABS.map(function (tab) {
      var active = tab.id === ui.tab ? " active" : "";
      return "<button class=\"nav-button" + active + "\" type=\"button\" data-action=\"nav\" data-tab=\"" + tab.id + "\"><span>" + tab.icon + "</span><span>" + tab.label + "</span></button>";
    }).join("");
  }

  function renderActiveView() {
    if (ui.tab === "rooms") return renderRoomsView();
    if (ui.tab === "tasks") return renderTasksView();
    if (ui.tab === "review") return renderReviewView();
    if (ui.tab === "settings") return renderSettingsView();
    return renderTodayView();
  }

  function renderTodayView() {
    var tasks = visibleTasks();
    var overdue = tasks.filter(function (task) { return getTaskStatus(task).bucket === "overdue"; }).sort(sortByDue);
    var dueToday = tasks.filter(function (task) { return getTaskStatus(task).bucket === "today"; }).sort(sortByPriorityThenMinutes);
    var quickWins = tasks.filter(function (task) {
      var status = getTaskStatus(task).bucket;
      return task.estimatedMinutes <= 10 && task.effort === "low" && status !== "paused" && status !== "done" && status !== "later";
    }).sort(sortByDue).slice(0, 6);
    var completedToday = completedHistorySince(todayKey(), 1);
    var recommended = recommendedTasks(3);
    var oneThing = ui.oneThingId ? state.tasks.find(function (task) { return task.id === ui.oneThingId; }) : null;
    var minutes = dueToday.concat(overdue).reduce(function (sum, task) { return sum + Number(task.estimatedMinutes || 0); }, 0);
    return "<div class=\"view-header\"><div><h2>Today</h2><p>You are maintaining things, not starting over. One small task still counts.</p></div><button type=\"button\" class=\"primary\" data-action=\"one-thing\">✨ One thing</button></div>" +
      "<div class=\"grid four\">" +
      summaryCard("🌱", overdue.length, "Overdue", overdue.length ? "Can be rescheduled kindly" : "Nothing waiting from before") +
      summaryCard("☀️", dueToday.length, "Due today", dueToday.length ? "Pick the smallest useful one" : "A soft day") +
      summaryCard("✅", completedToday.length, "Done today", completedToday.length ? "Nice, that counts" : "Ready when you are") +
      summaryCard("⏱️", minutes, "Estimated minutes", "Only if you did every due task") +
      "</div>" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>Today’s tiny reset</h3><p>Small, visible, and realistic.</p></div>" + renderEnergyMode() + "</div>" +
      (recommended.length ? "<div class=\"grid three\">" + recommended.map(function (task) { return renderTaskCard(task, { compact: true }); }).join("") + "</div>" : emptyState("No tiny reset is due right now. You can add one or use an as-needed task.")) + "</section>" +
      (oneThing ? "<section class=\"panel\"><div class=\"section-title\"><div><h3>Just one thing</h3><p>This is a realistic next step.</p></div><button type=\"button\" data-action=\"clear-one-thing\">Clear</button></div>" + renderTaskCard(oneThing, { highlight: true }) + "</section>" : "") +
      renderTaskSection("Overdue", overdue, "Nothing overdue. If something was not realistic, snoozing or skipping it is planning.") +
      renderTaskSection("Due today", dueToday, "No tasks due today. Add a small reset or enjoy the room you already made easier.") +
      renderTaskSection("Quick wins under 10 minutes", quickWins, "No quick wins match right now. You can adjust task minutes or effort anytime.") +
      renderCompletedToday(completedToday);
  }

  function renderEnergyMode() {
    var mode = state.settings.energyMode || "normal";
    return "<div class=\"segmented\" aria-label=\"Energy mode\">" +
      segmentButton("low", "Low", mode) +
      segmentButton("normal", "Normal", mode) +
      segmentButton("deep", "Deep", mode) +
      "</div>";
  }

  function segmentButton(value, label, current) {
    var active = value === current ? " active" : "";
    return "<button class=\"" + active.trim() + "\" type=\"button\" data-action=\"energy-mode\" data-mode=\"" + value + "\">" + label + "</button>";
  }

  function renderRoomsView() {
    if (ui.selectedRoomId) return renderRoomDetail(ui.selectedRoomId);
    var rooms = activeRooms();
    return "<div class=\"view-header\"><div><h2>Rooms</h2><p>See what needs attention by room, then reset one small area at a time.</p></div><button type=\"button\" class=\"primary\" data-action=\"add-room\">＋ Room</button></div>" +
      "<div class=\"grid three\">" + rooms.map(renderRoomCard).join("") + "</div>";
  }

  function renderRoomCard(room) {
    var snapshot = getRoomSnapshot(room.id);
    var next = snapshot.upcoming[0] || snapshot.today[0] || snapshot.overdue[0];
    return "<article class=\"room-card\">" +
      "<div class=\"room-head\"><div class=\"room-title\"><div class=\"room-icon\" style=\"background:" + escapeAttr(room.color) + "\">" + escapeHtml(room.icon) + "</div><div><h3>" + escapeHtml(room.name) + "</h3><p>" + escapeHtml(snapshot.label) + "</p></div></div><button class=\"icon-button\" type=\"button\" data-action=\"open-room\" data-id=\"" + room.id + "\" aria-label=\"Open room\">›</button></div>" +
      "<div class=\"chips\"><span class=\"chip gold\">" + snapshot.today.length + " due</span><span class=\"chip rose\">" + snapshot.overdue.length + " overdue</span><span class=\"chip sage\">" + snapshot.recent.length + " recent</span></div>" +
      "<div><span class=\"mini-label\">Reset level</span><div class=\"health\" style=\"--level:" + snapshot.health + "%\"><span></span></div></div>" +
      "<p>Next: " + escapeHtml(next ? next.title : "No scheduled tasks") + "</p>" +
      "<div class=\"inline-actions\"><button type=\"button\" data-action=\"open-room\" data-id=\"" + room.id + "\">Open</button><button type=\"button\" data-action=\"edit-room\" data-id=\"" + room.id + "\">Edit</button><button type=\"button\" data-action=\"move-room\" data-id=\"" + room.id + "\" data-direction=\"up\" aria-label=\"Move room up\">↑</button><button type=\"button\" data-action=\"move-room\" data-id=\"" + room.id + "\" data-direction=\"down\" aria-label=\"Move room down\">↓</button></div>" +
      "</article>";
  }

  function renderRoomDetail(roomId) {
    var room = getRoom(roomId);
    if (!room) {
      ui.selectedRoomId = null;
      return renderRoomsView();
    }
    var snapshot = getRoomSnapshot(room.id);
    return "<div class=\"view-header\"><div><button type=\"button\" data-action=\"back-rooms\">← Rooms</button><h2>" + escapeHtml(room.icon + " " + room.name) + "</h2><p>" + escapeHtml(room.notes || "One room, one small reset at a time.") + "</p></div><div class=\"button-row\"><button type=\"button\" data-action=\"start-room-reset\" data-id=\"" + room.id + "\">▶ Reset mode</button><button type=\"button\" class=\"primary\" data-action=\"add-task-room\" data-room=\"" + room.id + "\">＋ Task</button></div></div>" +
      "<div class=\"grid three\">" + summaryCard("☀️", snapshot.today.length, "Due today", "For this room") + summaryCard("🌱", snapshot.overdue.length, "Overdue", "Planning is allowed") + summaryCard("✨", snapshot.health + "%", "Reset level", snapshot.label) + "</div>" +
      renderTaskSection("Overdue", snapshot.overdue, "Nothing overdue in this room.") +
      renderTaskSection("Due today", snapshot.today, "Nothing due today in this room.") +
      renderTaskSection("Upcoming", snapshot.upcoming.slice(0, 8), "No upcoming scheduled tasks here.") +
      renderTaskSection("Done recently", snapshot.recent, "No recent completions yet.", { done: true });
  }

  function renderTasksView() {
    var filtered = filteredTasks();
    ui.visibleTaskIds = filtered.map(function (task) { return task.id; });
    var selectedCount = ui.selectedTaskIds.size;
    return "<div class=\"view-header\"><div><h2>Tasks</h2><p>Search, filter, edit, and gently adjust the plan.</p></div><button type=\"button\" class=\"primary\" data-action=\"quick-add\">＋ Task</button></div>" +
      renderTaskFilters() +
      "<section class=\"panel\"><div class=\"section-title\"><div><h3>All matching tasks</h3><p>" + filtered.length + " shown" + (selectedCount ? ", " + selectedCount + " selected" : "") + "</p></div><div class=\"button-row\"><button type=\"button\" data-action=\"select-visible\">Select shown</button><button type=\"button\" data-action=\"clear-selection\">Clear</button></div></div>" +
      (selectedCount ? "<div class=\"button-row\" style=\"margin-bottom:12px\"><button type=\"button\" data-action=\"bulk-complete\">Complete selected</button><button type=\"button\" data-action=\"bulk-snooze\">Snooze selected</button><button type=\"button\" data-action=\"bulk-skip\">Skip selected</button></div>" : "") +
      (filtered.length ? "<div class=\"stack\">" + filtered.map(function (task) { return renderTaskCard(task, { selectable: true }); }).join("") + "</div>" : emptyState("No tasks match those filters.")) +
      "</section>";
  }

  function renderTaskFilters() {
    var filters = ui.filters;
    return "<section class=\"filters\">" +
      fieldWrap("Search", "<input type=\"search\" value=\"" + escapeAttr(filters.search) + "\" placeholder=\"Task, room, note, tag...\" data-action=\"search-tasks\">", "filter-search") +
      fieldWrap("Room", "<select data-action=\"filter-tasks\" data-filter=\"room\">" + option("all", "All rooms", filters.room) + activeRooms().map(function (room) { return option(room.id, room.icon + " " + room.name, filters.room); }).join("") + "</select>", "filter-room") +
      fieldWrap("Due", "<select data-action=\"filter-tasks\" data-filter=\"due\">" + option("all", "Any status", filters.due) + option("overdue", "Overdue", filters.due) + option("today", "Due today", filters.due) + option("upcoming", "Upcoming", filters.due) + option("later", "Later", filters.due) + option("paused", "Paused/as needed", filters.due) + "</select>", "filter-due") +
      fieldWrap("Effort", "<select data-action=\"filter-tasks\" data-filter=\"effort\">" + option("all", "Any effort", filters.effort) + EFFORTS.map(function (item) { return option(item, capitalize(item), filters.effort); }).join("") + "</select>", "filter-effort") +
      fieldWrap("Priority", "<select data-action=\"filter-tasks\" data-filter=\"priority\">" + option("all", "Any priority", filters.priority) + PRIORITIES.map(function (item) { return option(item, capitalize(item), filters.priority); }).join("") + "</select>", "filter-priority") +
      fieldWrap("Frequency", "<select data-action=\"filter-tasks\" data-filter=\"frequency\">" + option("all", "Any frequency", filters.frequency) + FREQUENCIES.map(function (item) { return option(item.value, item.label, filters.frequency); }).join("") + "</select>", "filter-frequency") +
      fieldWrap("Tag", "<select data-action=\"filter-tasks\" data-filter=\"tag\">" + option("all", "Any tag", filters.tag) + allTags().map(function (tag) { return option(tag, tag, filters.tag); }).join("") + "</select>", "filter-tag") +
      fieldWrap("Sort", "<select data-action=\"filter-tasks\" data-filter=\"sort\">" + option("most-overdue", "Most overdue", filters.sort) + option("due-soon", "Due soon", filters.sort) + option("shortest", "Shortest first", filters.sort) + option("room-order", "Room order", filters.sort) + option("priority", "Priority", filters.sort) + "</select>", "filter-sort") +
      "</section>";
  }

  function renderReviewView() {
    var range = ui.reviewRange;
    var completedWeek = completedHistorySince(offsetDate(-6), 7).length;
    var completedMonth = completedHistorySince(offsetDate(-29), 30).length;
    var overdue = visibleTasks().filter(function (task) { return getTaskStatus(task).bucket === "overdue"; }).length;
    var average = Math.round((completedHistorySince(offsetDate(-6), 7).length / 7) * 10) / 10;
    return "<div class=\"view-header\"><div><h2>Review</h2><p>Patterns without judgment. The goal is learning what helps.</p></div><div class=\"segmented\"><button type=\"button\" class=\"" + (range === 7 ? "active" : "") + "\" data-action=\"review-range\" data-range=\"7\">7 days</button><button type=\"button\" class=\"" + (range === 30 ? "active" : "") + "\" data-action=\"review-range\" data-range=\"30\">30 days</button></div></div>" +
      "<div class=\"grid four\">" + summaryCard("✅", completedWeek, "Completed this week", "Every check helps") + summaryCard("📅", completedMonth, "Completed this month", "Small resets add up") + summaryCard("⌀", average, "Average per day", "Over the last week") + summaryCard("🌱", overdue, "Overdue tasks", "Use snooze, skip, or reschedule") + "</div>" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>Completed tasks</h3><p>Last " + range + " days</p></div></div>" + renderCompletionChart(range) + "</section>" +
      "<div class=\"grid two\"><section class=\"card\"><div class=\"section-title\"><div><h3>Rooms most maintained</h3><p>Completed tasks by room.</p></div></div>" + renderRoomBreakdown() + "</section>" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>Rooms needing attention</h3><p>Due and overdue tasks by room.</p></div></div>" + renderAttentionRooms() + "</section></div>" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>What helped?</h3><p>Private notes stored only in this browser.</p></div></div><textarea data-action=\"reflection-notes\" placeholder=\"Example: low-energy tasks after breakfast worked well.\">" + escapeHtml(state.settings.reflectionNotes || "") + "</textarea></section>";
  }

  function renderSettingsView() {
    return "<div class=\"view-header\"><div><h2>Settings</h2><p>Customize the plan, manage presets, and keep a backup.</p></div></div>" +
      "<div class=\"grid two\">" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>Theme</h3><p>Cozy neutral with your accent color.</p></div></div>" +
      fieldWrap("Accent color", "<input type=\"color\" value=\"" + escapeAttr(state.settings.accentColor) + "\" data-action=\"change-accent\">", "accent") +
      "<label class=\"check-label\"><input type=\"checkbox\" data-action=\"change-compact\" " + checked(state.settings.compactMode) + "> Compact mode</label></section>" +
      "<section class=\"card\"><div class=\"section-title\"><div><h3>Default task preferences</h3><p>Used when you add a new task.</p></div></div>" +
      "<div class=\"form-grid two\">" +
      fieldWrap("Frequency", "<select data-action=\"default-setting\" data-setting=\"defaultFrequencyType\">" + FREQUENCIES.map(function (item) { return option(item.value, item.label, state.settings.defaultFrequencyType); }).join("") + "</select>", "default-frequency") +
      fieldWrap("Interval", "<input type=\"number\" min=\"1\" value=\"" + escapeAttr(state.settings.defaultFrequencyInterval) + "\" data-action=\"default-setting\" data-setting=\"defaultFrequencyInterval\">", "default-interval") +
      fieldWrap("Effort", "<select data-action=\"default-setting\" data-setting=\"defaultEffort\">" + EFFORTS.map(function (item) { return option(item, capitalize(item), state.settings.defaultEffort); }).join("") + "</select>", "default-effort") +
      fieldWrap("Minutes", "<input type=\"number\" min=\"1\" value=\"" + escapeAttr(state.settings.defaultEstimatedMinutes) + "\" data-action=\"default-setting\" data-setting=\"defaultEstimatedMinutes\">", "default-minutes") +
      "</div></section>" +
      "</div>" +
      renderRoomManager() +
      renderTemplateManager() +
      renderDataManager();
  }

  function renderRoomManager() {
    return "<section class=\"card\"><div class=\"section-title\"><div><h3>Manage rooms</h3><p>Add, edit, archive, and reorder rooms.</p></div><button type=\"button\" data-action=\"add-room\">＋ Room</button></div>" +
      "<div class=\"room-manager\">" + state.rooms.slice().sort(sortRooms).map(function (room) {
        return "<div class=\"manager-row\"><div><strong>" + escapeHtml(room.icon + " " + room.name) + "</strong><br><span class=\"label\">" + (room.archived ? "Hidden" : "Visible") + " · order " + room.sortOrder + "</span></div><div class=\"inline-actions\"><button type=\"button\" data-action=\"edit-room\" data-id=\"" + room.id + "\">Edit</button><button type=\"button\" data-action=\"move-room\" data-id=\"" + room.id + "\" data-direction=\"up\">↑</button><button type=\"button\" data-action=\"move-room\" data-id=\"" + room.id + "\" data-direction=\"down\">↓</button></div></div>";
      }).join("") + "</div></section>";
  }

  function renderTemplateManager() {
    return "<section class=\"card\"><div class=\"section-title\"><div><h3>Task templates</h3><p>Starter cleaning ideas. Edit them or add one to your task list.</p></div><button type=\"button\" data-action=\"add-template\">＋ Template</button></div>" +
      "<div class=\"template-list\">" + state.templates.tasks.map(function (template) {
        return "<div class=\"manager-row\"><div><strong>" + escapeHtml(template.title) + "</strong><br><span class=\"label\">" + escapeHtml(template.suggestedRoomName) + " · " + formatFrequency(template) + " · " + template.estimatedMinutes + " min</span></div><div class=\"inline-actions\"><button type=\"button\" data-action=\"add-task-template\" data-id=\"" + template.id + "\">Add</button><button type=\"button\" data-action=\"edit-template\" data-id=\"" + template.id + "\">Edit</button><button type=\"button\" data-action=\"delete-template\" data-id=\"" + template.id + "\">Delete</button></div></div>";
      }).join("") + "</div></section>";
  }

  function renderDataManager() {
    return "<section class=\"card\"><div class=\"section-title\"><div><h3>Data and privacy</h3><p>Your cleaning data is stored locally in this browser.</p></div></div>" +
      "<p>No account or backend is used. Export a JSON backup before clearing browser data or moving devices.</p>" +
      "<div class=\"button-row\"><button type=\"button\" class=\"primary\" data-action=\"export-data\">⬇ Export JSON backup</button><button type=\"button\" data-action=\"import-click\">⬆ Import JSON backup</button><button type=\"button\" class=\"danger\" data-action=\"reset-sample\">Reset sample data</button></div>" +
      "<input class=\"hidden-file\" type=\"file\" accept=\"application/json,.json\" data-action=\"import-data\" id=\"import-file\">" +
      "</section>";
  }

  function renderTaskSection(title, tasks, emptyText, options) {
    options = options || {};
    return "<section class=\"stack\"><div class=\"section-title\"><div><h3>" + escapeHtml(title) + "</h3><p>" + tasks.length + " task" + (tasks.length === 1 ? "" : "s") + "</p></div></div>" +
      (tasks.length ? "<div class=\"stack\">" + tasks.map(function (task) { return renderTaskCard(task, options); }).join("") + "</div>" : emptyState(emptyText)) +
      "</section>";
  }

  function renderTaskCard(task, options) {
    options = options || {};
    var room = getRoom(task.roomId) || { name: "Unknown room", icon: "🏠", color: "#e3d7ca" };
    var status = getTaskStatus(task);
    var isSelected = ui.selectedTaskIds.has(task.id);
    var selectable = options.selectable ? "<label class=\"check-label\"><input type=\"checkbox\" data-action=\"task-select\" data-id=\"" + task.id + "\" " + checked(isSelected) + "> Select</label>" : "";
    var highlight = options.highlight || ui.oneThingId === task.id ? " highlight" : "";
    var chips = [
      chip(status.label, status.tone),
      chip(room.icon + " " + room.name, ""),
      chip(task.estimatedMinutes + " min", "blue"),
      chip(capitalize(task.effort) + " effort", ""),
      chip(capitalize(task.priority) + " priority", task.priority === "high" ? "gold" : ""),
      chip(typeLabel(task.taskType), task.taskType === "deep-clean" ? "rose" : "sage")
    ];
    if (task.tags && task.tags.length) {
      task.tags.slice(0, 3).forEach(function (tag) { chips.push(chip("#" + tag, "")); });
    }
    return "<article class=\"task-card " + status.bucket + highlight + "\" data-task-card=\"" + task.id + "\">" +
      "<div class=\"task-top\"><div class=\"task-icon\" style=\"background:" + escapeAttr(room.color || "#e3d7ca") + "\">" + escapeHtml(room.icon || "🏠") + "</div><div class=\"task-main\"><div class=\"task-title-row\"><h3>" + escapeHtml(task.title) + "</h3>" + selectable + "</div><p>" + escapeHtml(task.description || formatFrequency(task)) + "</p></div></div>" +
      "<div class=\"chips\">" + chips.join("") + "</div>" +
      "<div class=\"task-actions\">" +
      "<button type=\"button\" class=\"primary\" data-action=\"complete-task\" data-id=\"" + task.id + "\">✓ Done</button>" +
      "<button type=\"button\" data-action=\"good-enough\" data-id=\"" + task.id + "\">Good enough</button>" +
      "<button type=\"button\" data-action=\"snooze-task\" data-id=\"" + task.id + "\">Snooze</button>" +
      "<button type=\"button\" data-action=\"skip-task\" data-id=\"" + task.id + "\">Skip once</button>" +
      "<button type=\"button\" data-action=\"reschedule-task\" data-id=\"" + task.id + "\">Reschedule</button>" +
      "<button type=\"button\" data-action=\"edit-task\" data-id=\"" + task.id + "\">Edit</button>" +
      "</div>" +
      "</article>";
  }

  function renderCompletedToday(items) {
    return "<section class=\"stack\"><div class=\"section-title\"><div><h3>Completed today</h3><p>Nice, that counts.</p></div></div>" +
      (items.length ? "<div class=\"grid two\">" + items.map(function (entry) {
        var task = state.tasks.find(function (item) { return item.id === entry.taskId; });
        var room = task ? getRoom(task.roomId) : null;
        return "<div class=\"card soft\"><strong>" + escapeHtml(task ? task.title : "Completed task") + "</strong><p>" + escapeHtml(room ? room.icon + " " + room.name : "") + " · " + formatTime(entry.date) + "</p></div>";
      }).join("") + "</div>" : emptyState("Nothing completed today yet. Even opening the app and choosing one tiny reset is a useful start.")) +
      "</section>";
  }

  function renderCompletionChart(days) {
    var counts = [];
    var max = 1;
    for (var i = days - 1; i >= 0; i--) {
      var key = offsetDate(-i);
      var count = state.history.filter(function (entry) { return entry.type === "completed" && dateOnly(entry.date) === key; }).length;
      max = Math.max(max, count);
      counts.push({ key: key, count: count });
    }
    return "<div class=\"chart\" style=\"--bars:" + days + "\" aria-label=\"Completed tasks chart\">" + counts.map(function (item) {
      var height = Math.max(5, Math.round((item.count / max) * 100));
      return "<div class=\"bar\" title=\"" + escapeAttr(item.key + ": " + item.count) + "\"><div class=\"bar-fill\" style=\"height:" + height + "%\"></div><div class=\"bar-label\">" + escapeHtml(shortDateLabel(item.key, days)) + "</div></div>";
    }).join("") + "</div>";
  }

  function renderRoomBreakdown() {
    var since = offsetDate(-29);
    var counts = activeRooms().map(function (room) {
      return { room: room, count: state.history.filter(function (entry) { return entry.type === "completed" && entry.roomId === room.id && compareDates(dateOnly(entry.date), since) >= 0; }).length };
    }).sort(function (a, b) { return b.count - a.count; });
    var max = Math.max(1, counts[0] ? counts[0].count : 1);
    return counts.length ? counts.slice(0, 8).map(function (item) {
      return breakdownRow(item.room.icon + " " + item.room.name, item.count, Math.round((item.count / max) * 100));
    }).join("") : emptyState("No completions yet.");
  }

  function renderAttentionRooms() {
    var rows = activeRooms().map(function (room) {
      var snapshot = getRoomSnapshot(room.id);
      return { room: room, count: snapshot.overdue.length * 2 + snapshot.today.length };
    }).filter(function (item) { return item.count > 0; }).sort(function (a, b) { return b.count - a.count; });
    var max = Math.max(1, rows[0] ? rows[0].count : 1);
    return rows.length ? rows.slice(0, 8).map(function (item) {
      return breakdownRow(item.room.icon + " " + item.room.name, item.count, Math.round((item.count / max) * 100));
    }).join("") : emptyState("No rooms are asking loudly right now.");
  }

  function summaryCard(icon, value, label, note) {
    return "<article class=\"card summary-card\"><div class=\"summary-icon\">" + icon + "</div><div><p class=\"metric\">" + escapeHtml(String(value)) + "</p><div class=\"label\">" + escapeHtml(label) + "</div><p style=\"margin:4px 0 0\">" + escapeHtml(note) + "</p></div></article>";
  }

  function emptyState(text) {
    return "<div class=\"empty\">" + escapeHtml(text) + "</div>";
  }

  function chip(text, tone) {
    return "<span class=\"chip" + (tone ? " " + tone : "") + "\">" + escapeHtml(text) + "</span>";
  }

  function fieldWrap(label, control, id) {
    return "<div class=\"field\"><label for=\"" + id + "\">" + escapeHtml(label) + "</label>" + control.replace(/(<input|<select|<textarea)/, "$1 id=\"" + id + "\"") + "</div>";
  }

  function option(value, label, current) {
    return "<option value=\"" + escapeAttr(value) + "\" " + selected(String(value) === String(current)) + ">" + escapeHtml(label) + "</option>";
  }

  function selected(active) {
    return active ? "selected" : "";
  }

  function checked(active) {
    return active ? "checked" : "";
  }

  function handleClick(event) {
    if (event.target.classList && event.target.classList.contains("modal-backdrop")) closeModal();
    var target = event.target.closest("[data-action]");
    if (!target) return;
    var action = target.dataset.action;
    var id = target.dataset.id;
    if (action === "nav") {
      ui.tab = target.dataset.tab;
      ui.selectedRoomId = null;
      render();
    }
    if (action === "quick-add") openTaskForm();
    if (action === "add-task-room") openTaskForm(null, { roomId: target.dataset.room });
    if (action === "edit-task") openTaskForm(id);
    if (action === "complete-task") completeTask(id, false);
    if (action === "good-enough") completeTask(id, true);
    if (action === "snooze-task") openSnoozeModal(id);
    if (action === "skip-task") skipTask(id);
    if (action === "reschedule-task") openRescheduleModal(id);
    if (action === "delete-task") archiveTask(id);
    if (action === "one-thing") pickOneThing();
    if (action === "clear-one-thing") { ui.oneThingId = null; render(); }
    if (action === "energy-mode") { state.settings.energyMode = target.dataset.mode; saveState(); render(); }
    if (action === "open-room") { ui.selectedRoomId = id; ui.tab = "rooms"; render(); }
    if (action === "back-rooms") { ui.selectedRoomId = null; render(); }
    if (action === "add-room") openRoomForm();
    if (action === "edit-room") openRoomForm(id);
    if (action === "delete-room") deleteRoom(id);
    if (action === "move-room") moveRoom(id, target.dataset.direction);
    if (action === "start-room-reset") openRoomResetMode(id);
    if (action === "reset-next") openRoomResetMode(id, target.dataset.skipid);
    if (action === "reset-complete") { completeTask(target.dataset.task, false, true); openRoomResetMode(id); }
    if (action === "reset-skip") { skipTask(target.dataset.task, true); openRoomResetMode(id); }
    if (action === "review-range") { ui.reviewRange = Number(target.dataset.range); render(); }
    if (action === "select-visible") { ui.visibleTaskIds.forEach(function (taskId) { ui.selectedTaskIds.add(taskId); }); render(); }
    if (action === "clear-selection") { ui.selectedTaskIds.clear(); render(); }
    if (action === "bulk-complete") bulkAction("complete");
    if (action === "bulk-snooze") bulkAction("snooze");
    if (action === "bulk-skip") bulkAction("skip");
    if (action === "apply-snooze") applySnooze(id, target.dataset.date || addDays(todayKey(), Number(target.dataset.days || 1)));
    if (action === "pick-snooze") {
      var snoozeDate = document.getElementById("snooze-date");
      if (snoozeDate && snoozeDate.value) applySnooze(id, snoozeDate.value);
    }
    if (action === "apply-reschedule") {
      var dueDate = document.getElementById("reschedule-date");
      if (dueDate && dueDate.value) rescheduleTask(id, dueDate.value);
    }
    if (action === "modal-close") closeModal();
    if (action === "export-data") exportData();
    if (action === "import-click") document.getElementById("import-file").click();
    if (action === "reset-sample") resetSampleData();
    if (action === "add-template") openTemplateForm();
    if (action === "edit-template") openTemplateForm(id);
    if (action === "delete-template") deleteTemplate(id);
    if (action === "add-task-template") addTaskFromTemplate(id);
  }

  function handleSubmit(event) {
    var form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "task") saveTaskForm(form);
    if (form.dataset.form === "room") saveRoomForm(form);
    if (form.dataset.form === "template") saveTemplateForm(form);
  }

  function handleChange(event) {
    var target = event.target;
    var action = target.dataset.action;
    if (action === "filter-tasks") {
      ui.filters[target.dataset.filter] = target.value;
      render();
    }
    if (action === "task-select") {
      if (target.checked) ui.selectedTaskIds.add(target.dataset.id);
      else ui.selectedTaskIds.delete(target.dataset.id);
      render();
    }
    if (action === "change-compact") {
      state.settings.compactMode = target.checked;
      saveState();
      render();
    }
    if (action === "default-setting") {
      var setting = target.dataset.setting;
      state.settings[setting] = target.type === "number" ? Math.max(1, Number(target.value) || 1) : target.value;
      saveState();
    }
    if (action === "import-data" && target.files && target.files[0]) importData(target.files[0]);
  }

  function handleInput(event) {
    var target = event.target;
    var action = target.dataset.action;
    if (action === "search-tasks") {
      ui.filters.search = target.value;
      render();
    }
    if (action === "change-accent") {
      state.settings.accentColor = target.value;
      saveState();
      applySettings();
    }
    if (action === "reflection-notes") {
      state.settings.reflectionNotes = target.value;
      saveState();
    }
  }

  function completeTask(taskId, goodEnough, quiet) {
    var task = getTask(taskId);
    if (!task) return;
    var dueBefore = effectiveDueDate(task);
    var now = new Date().toISOString();
    var today = todayKey();
    task.lastCompletedDate = today;
    task.completionHistory.push({ date: today, note: goodEnough ? "Good enough done" : "Completed" });
    if (task.frequencyType === "one-time") {
      task.status = "completed";
      task.nextDueDate = null;
    } else if (task.frequencyType === "as-needed" || task.frequencyType === "seasonal") {
      task.status = "active";
      task.nextDueDate = null;
    } else {
      task.nextDueDate = calculateNextDueDate(task, today);
      task.status = "active";
    }
    task.snoozeDate = null;
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "completed", date: now, note: goodEnough ? "Good enough done" : "Completed", dueDate: dueBefore, nextDueDate: task.nextDueDate });
    saveState();
    render();
    if (!quiet) showToast(goodEnough ? "Good enough counts." : "Nice, that counts.");
  }

  function skipTask(taskId, quiet) {
    var task = getTask(taskId);
    if (!task) return;
    var dueBefore = effectiveDueDate(task);
    task.nextDueDate = calculateNextDueDate(task, dueBefore || todayKey());
    task.snoozeDate = null;
    task.status = "active";
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "skipped", date: new Date().toISOString(), note: "Skipped once without penalty", dueDate: dueBefore, nextDueDate: task.nextDueDate });
    saveState();
    render();
    if (!quiet) showToast("Skipped once. That is planning, not failing.");
  }

  function applySnooze(taskId, date) {
    var task = getTask(taskId);
    if (!task) return;
    task.snoozeDate = date;
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "snoozed", date: new Date().toISOString(), note: "Snoozed until " + date, dueDate: task.nextDueDate, nextDueDate: date });
    saveState();
    closeModal();
    render();
    showToast("Snoozed until " + formatDate(date) + ".");
  }

  function rescheduleTask(taskId, date) {
    var task = getTask(taskId);
    if (!task) return;
    var before = task.nextDueDate;
    task.nextDueDate = date;
    task.snoozeDate = null;
    task.status = "active";
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "rescheduled", date: new Date().toISOString(), note: "Rescheduled", dueDate: before, nextDueDate: date });
    saveState();
    closeModal();
    render();
    showToast("Rescheduled for " + formatDate(date) + ".");
  }

  function archiveTask(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    if (!confirm("Archive this task? Its history will stay in your review.")) return;
    task.status = "archived";
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "archived", date: new Date().toISOString(), note: "Task archived", dueDate: task.nextDueDate, nextDueDate: null });
    saveState();
    closeModal();
    render();
    showToast("Task archived.");
  }

  function openTaskForm(taskId, defaults) {
    defaults = defaults || {};
    var existing = taskId ? getTask(taskId) : null;
    var task = existing || normalizeTask({
      roomId: defaults.roomId || (activeRooms()[0] ? activeRooms()[0].id : "whole-home"),
      frequencyType: state.settings.defaultFrequencyType,
      frequencyInterval: state.settings.defaultFrequencyInterval,
      effort: state.settings.defaultEffort,
      estimatedMinutes: state.settings.defaultEstimatedMinutes,
      nextDueDate: todayKey()
    });
    var title = existing ? "Edit task" : "Add task";
    openModal(title, "<form class=\"form-grid\" data-form=\"task\" data-id=\"" + (existing ? existing.id : "") + "\">" +
      fieldWrap("Task title", "<input name=\"title\" required value=\"" + escapeAttr(task.title || "") + "\" placeholder=\"Wipe counters\">", "task-title") +
      fieldWrap("Room", "<select name=\"roomId\">" + activeRooms().map(function (room) { return option(room.id, room.icon + " " + room.name, task.roomId); }).join("") + "</select>", "task-room") +
      fieldWrap("Notes", "<textarea name=\"description\" placeholder=\"Make the task specific and kind.\">" + escapeHtml(task.description || "") + "</textarea>", "task-description") +
      "<div class=\"form-grid two\">" +
      fieldWrap("Frequency", "<select name=\"frequencyType\">" + FREQUENCIES.map(function (item) { return option(item.value, item.label, task.frequencyType); }).join("") + "</select>", "task-frequency") +
      fieldWrap("Interval", "<input type=\"number\" name=\"frequencyInterval\" min=\"1\" value=\"" + escapeAttr(task.frequencyInterval || 1) + "\">", "task-interval") +
      fieldWrap("Next due date", "<input type=\"date\" name=\"nextDueDate\" value=\"" + escapeAttr(task.nextDueDate || todayKey()) + "\">", "task-due") +
      fieldWrap("Estimated minutes", "<input type=\"number\" name=\"estimatedMinutes\" min=\"1\" value=\"" + escapeAttr(task.estimatedMinutes || 10) + "\">", "task-minutes") +
      fieldWrap("Effort", "<select name=\"effort\">" + EFFORTS.map(function (item) { return option(item, capitalize(item), task.effort); }).join("") + "</select>", "task-effort") +
      fieldWrap("Priority", "<select name=\"priority\">" + PRIORITIES.map(function (item) { return option(item, capitalize(item), task.priority); }).join("") + "</select>", "task-priority") +
      fieldWrap("Task type", "<select name=\"taskType\">" + TASK_TYPES.map(function (item) { return option(item.value, item.label, task.taskType); }).join("") + "</select>", "task-type") +
      fieldWrap("Tags", "<input name=\"tags\" value=\"" + escapeAttr((task.tags || []).join(", ")) + "\" placeholder=\"quick, floor\">", "task-tags") +
      "</div>" +
      "<div><span class=\"mini-label\">Specific weekdays</span><div class=\"weekday-grid\">" + WEEKDAYS.map(function (day) { return "<label><input type=\"checkbox\" name=\"weekdays\" value=\"" + day.value + "\" " + checked((task.weekdays || []).indexOf(day.value) >= 0) + ">" + day.short + "</label>"; }).join("") + "</div></div>" +
      "<label class=\"check-label\"><input type=\"checkbox\" name=\"seasonalPaused\" " + checked(task.seasonalPaused) + "> Seasonal or paused for now</label>" +
      "<div class=\"form-actions\"><button class=\"primary\" type=\"submit\">Save task</button>" + (existing ? "<button class=\"danger\" type=\"button\" data-action=\"delete-task\" data-id=\"" + existing.id + "\">Archive task</button>" : "") + "<button type=\"button\" data-action=\"modal-close\">Cancel</button></div>" +
      "</form>");
  }

  function saveTaskForm(form) {
    var data = new FormData(form);
    var existingId = form.dataset.id;
    var payload = normalizeTask({
      id: existingId || makeId("task"),
      roomId: data.get("roomId"),
      title: String(data.get("title") || "").trim(),
      description: String(data.get("description") || "").trim(),
      frequencyType: data.get("frequencyType"),
      frequencyInterval: Number(data.get("frequencyInterval") || 1),
      weekdays: data.getAll("weekdays").map(Number),
      nextDueDate: data.get("nextDueDate") || null,
      estimatedMinutes: Number(data.get("estimatedMinutes") || 10),
      effort: data.get("effort"),
      priority: data.get("priority"),
      status: "active",
      lastCompletedDate: null,
      completionHistory: [],
      snoozeDate: null,
      seasonalPaused: data.get("seasonalPaused") === "on",
      tags: splitTags(data.get("tags") || ""),
      taskType: data.get("taskType")
    });
    if (!payload.title) return;
    if (payload.frequencyType === "as-needed" || payload.frequencyType === "seasonal" || payload.seasonalPaused) payload.nextDueDate = null;
    var index = state.tasks.findIndex(function (task) { return task.id === existingId; });
    if (index >= 0) {
      payload.lastCompletedDate = state.tasks[index].lastCompletedDate;
      payload.completionHistory = state.tasks[index].completionHistory || [];
      payload.snoozeDate = state.tasks[index].snoozeDate || null;
      state.tasks[index] = payload;
      state.history.push({ id: makeId("history"), taskId: payload.id, roomId: payload.roomId, type: "updated", date: new Date().toISOString(), note: "Task edited", dueDate: payload.nextDueDate, nextDueDate: payload.nextDueDate });
      showToast("Task updated.");
    } else {
      state.tasks.push(payload);
      state.history.push({ id: makeId("history"), taskId: payload.id, roomId: payload.roomId, type: "created", date: new Date().toISOString(), note: "Task created", dueDate: payload.nextDueDate, nextDueDate: payload.nextDueDate });
      showToast("Task added.");
    }
    saveState();
    closeModal();
    render();
  }

  function openRoomForm(roomId) {
    var existing = roomId ? getRoom(roomId) : null;
    var room = existing || { name: "", icon: "🏠", color: "#d9c9b7", notes: "", archived: false };
    openModal(existing ? "Edit room" : "Add room", "<form class=\"form-grid\" data-form=\"room\" data-id=\"" + (existing ? existing.id : "") + "\">" +
      fieldWrap("Room name", "<input name=\"name\" required value=\"" + escapeAttr(room.name) + "\" placeholder=\"Pantry\">", "room-name") +
      "<div class=\"form-grid two\">" + fieldWrap("Icon or emoji", "<input name=\"icon\" value=\"" + escapeAttr(room.icon) + "\">", "room-icon") + fieldWrap("Color", "<input type=\"color\" name=\"color\" value=\"" + escapeAttr(room.color || "#d9c9b7") + "\">", "room-color") + "</div>" +
      fieldWrap("Notes", "<textarea name=\"notes\" placeholder=\"Optional room note.\">" + escapeHtml(room.notes || "") + "</textarea>", "room-notes") +
      "<label class=\"check-label\"><input type=\"checkbox\" name=\"archived\" " + checked(room.archived) + "> Hide this room</label>" +
      "<div class=\"form-actions\"><button class=\"primary\" type=\"submit\">Save room</button>" + (existing ? "<button class=\"danger\" type=\"button\" data-action=\"delete-room\" data-id=\"" + existing.id + "\">Delete or hide</button>" : "") + "<button type=\"button\" data-action=\"modal-close\">Cancel</button></div>" +
      "</form>");
  }

  function saveRoomForm(form) {
    var data = new FormData(form);
    var existingId = form.dataset.id;
    var payload = normalizeRoom({
      id: existingId || makeId("room"),
      name: String(data.get("name") || "").trim(),
      icon: String(data.get("icon") || "🏠").trim(),
      color: data.get("color") || "#d9c9b7",
      notes: String(data.get("notes") || "").trim(),
      archived: data.get("archived") === "on",
      sortOrder: existingId && getRoom(existingId) ? getRoom(existingId).sortOrder : nextRoomSortOrder()
    });
    if (!payload.name) return;
    var index = state.rooms.findIndex(function (room) { return room.id === existingId; });
    if (index >= 0) state.rooms[index] = payload;
    else state.rooms.push(payload);
    saveState();
    closeModal();
    render();
    showToast(existingId ? "Room updated." : "Room added.");
  }

  function deleteRoom(roomId) {
    var room = getRoom(roomId);
    if (!room) return;
    var used = state.tasks.some(function (task) { return task.roomId === roomId && task.status !== "archived"; });
    if (used) {
      if (!confirm("This room has tasks. Hide it instead?")) return;
      room.archived = true;
      saveState();
      closeModal();
      ui.selectedRoomId = null;
      render();
      showToast("Room hidden.");
      return;
    }
    if (!confirm("Delete this room?")) return;
    state.rooms = state.rooms.filter(function (item) { return item.id !== roomId; });
    saveState();
    closeModal();
    ui.selectedRoomId = null;
    render();
    showToast("Room deleted.");
  }

  function moveRoom(roomId, direction) {
    var rooms = state.rooms.slice().sort(sortRooms);
    var index = rooms.findIndex(function (room) { return room.id === roomId; });
    if (index < 0) return;
    var swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= rooms.length) return;
    var temp = rooms[index].sortOrder;
    rooms[index].sortOrder = rooms[swapIndex].sortOrder;
    rooms[swapIndex].sortOrder = temp;
    saveState();
    render();
  }

  function openTemplateForm(templateId) {
    var existing = templateId ? state.templates.tasks.find(function (item) { return item.id === templateId; }) : null;
    var template = normalizeTemplate(existing || { suggestedRoomName: "Whole Home" });
    openModal(existing ? "Edit template" : "Add template", "<form class=\"form-grid\" data-form=\"template\" data-id=\"" + (existing ? existing.id : "") + "\">" +
      fieldWrap("Template title", "<input name=\"title\" required value=\"" + escapeAttr(template.title) + "\">", "template-title") +
      fieldWrap("Suggested room", "<input name=\"suggestedRoomName\" value=\"" + escapeAttr(template.suggestedRoomName) + "\">", "template-room") +
      fieldWrap("Notes", "<textarea name=\"description\">" + escapeHtml(template.description || "") + "</textarea>", "template-description") +
      "<div class=\"form-grid two\">" +
      fieldWrap("Frequency", "<select name=\"frequencyType\">" + FREQUENCIES.map(function (item) { return option(item.value, item.label, template.frequencyType); }).join("") + "</select>", "template-frequency") +
      fieldWrap("Interval", "<input type=\"number\" min=\"1\" name=\"frequencyInterval\" value=\"" + escapeAttr(template.frequencyInterval) + "\">", "template-interval") +
      fieldWrap("Minutes", "<input type=\"number\" min=\"1\" name=\"estimatedMinutes\" value=\"" + escapeAttr(template.estimatedMinutes) + "\">", "template-minutes") +
      fieldWrap("Effort", "<select name=\"effort\">" + EFFORTS.map(function (item) { return option(item, capitalize(item), template.effort); }).join("") + "</select>", "template-effort") +
      fieldWrap("Priority", "<select name=\"priority\">" + PRIORITIES.map(function (item) { return option(item, capitalize(item), template.priority); }).join("") + "</select>", "template-priority") +
      fieldWrap("Task type", "<select name=\"taskType\">" + TASK_TYPES.map(function (item) { return option(item.value, item.label, template.taskType); }).join("") + "</select>", "template-type") +
      "</div>" + fieldWrap("Tags", "<input name=\"tags\" value=\"" + escapeAttr((template.tags || []).join(", ")) + "\">", "template-tags") +
      "<div class=\"form-actions\"><button class=\"primary\" type=\"submit\">Save template</button><button type=\"button\" data-action=\"modal-close\">Cancel</button></div></form>");
  }

  function saveTemplateForm(form) {
    var data = new FormData(form);
    var existingId = form.dataset.id;
    var payload = normalizeTemplate({
      id: existingId || makeId("template"),
      suggestedRoomName: String(data.get("suggestedRoomName") || "Whole Home").trim(),
      title: String(data.get("title") || "").trim(),
      description: String(data.get("description") || "").trim(),
      frequencyType: data.get("frequencyType"),
      frequencyInterval: Number(data.get("frequencyInterval") || 1),
      estimatedMinutes: Number(data.get("estimatedMinutes") || 10),
      effort: data.get("effort"),
      priority: data.get("priority"),
      taskType: data.get("taskType"),
      tags: splitTags(data.get("tags") || "")
    });
    if (!payload.title) return;
    var index = state.templates.tasks.findIndex(function (item) { return item.id === existingId; });
    if (index >= 0) state.templates.tasks[index] = payload;
    else state.templates.tasks.push(payload);
    saveState();
    closeModal();
    render();
    showToast(existingId ? "Template updated." : "Template added.");
  }

  function deleteTemplate(templateId) {
    if (!confirm("Delete this template? Existing tasks will stay.")) return;
    state.templates.tasks = state.templates.tasks.filter(function (item) { return item.id !== templateId; });
    saveState();
    render();
    showToast("Template deleted.");
  }

  function addTaskFromTemplate(templateId) {
    var template = state.templates.tasks.find(function (item) { return item.id === templateId; });
    if (!template) return;
    var room = activeRooms().find(function (item) { return item.name.toLowerCase() === String(template.suggestedRoomName || "").toLowerCase(); }) || activeRooms()[0];
    var task = normalizeTask({
      id: makeId("task"),
      roomId: room ? room.id : "whole-home",
      title: template.title,
      description: template.description,
      frequencyType: template.frequencyType,
      frequencyInterval: template.frequencyInterval,
      nextDueDate: template.frequencyType === "as-needed" || template.frequencyType === "seasonal" ? null : todayKey(),
      estimatedMinutes: template.estimatedMinutes,
      effort: template.effort,
      priority: template.priority,
      status: "active",
      seasonalPaused: template.frequencyType === "seasonal",
      tags: template.tags || [],
      taskType: template.taskType
    });
    state.tasks.push(task);
    state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "created", date: new Date().toISOString(), note: "Task created from template", dueDate: task.nextDueDate, nextDueDate: task.nextDueDate });
    saveState();
    render();
    showToast("Template added as a task.");
  }

  function openSnoozeModal(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    openModal("Snooze task", "<div class=\"stack\"><p>Move <strong>" + escapeHtml(task.title) + "</strong> out of today without marking it done.</p><div class=\"button-row\"><button type=\"button\" data-action=\"apply-snooze\" data-id=\"" + task.id + "\" data-days=\"1\">Tomorrow</button><button type=\"button\" data-action=\"apply-snooze\" data-id=\"" + task.id + "\" data-days=\"3\">3 days</button><button type=\"button\" data-action=\"apply-snooze\" data-id=\"" + task.id + "\" data-days=\"7\">1 week</button></div>" + fieldWrap("Pick date", "<input type=\"date\" id=\"snooze-date\" value=\"" + addDays(todayKey(), 1) + "\">", "snooze-date-wrap") + "<div class=\"form-actions\"><button class=\"primary\" type=\"button\" data-action=\"pick-snooze\" data-id=\"" + task.id + "\">Snooze until date</button><button type=\"button\" data-action=\"modal-close\">Cancel</button></div></div>");
  }

  function openRescheduleModal(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    openModal("Reschedule task", "<div class=\"stack\"><p>Choose the next planned date for <strong>" + escapeHtml(task.title) + "</strong>.</p>" + fieldWrap("Next due date", "<input type=\"date\" id=\"reschedule-date\" value=\"" + escapeAttr(task.nextDueDate || todayKey()) + "\">", "reschedule-date-wrap") + "<div class=\"form-actions\"><button class=\"primary\" type=\"button\" data-action=\"apply-reschedule\" data-id=\"" + task.id + "\">Reschedule</button><button type=\"button\" data-action=\"modal-close\">Cancel</button></div></div>");
  }

  function openRoomResetMode(roomId, skipId) {
    var room = getRoom(roomId);
    if (!room) return;
    var queue = visibleTasks().filter(function (task) { return task.roomId === roomId && task.id !== skipId; }).filter(function (task) {
      var bucket = getTaskStatus(task).bucket;
      return bucket === "overdue" || bucket === "today" || bucket === "upcoming";
    }).sort(sortByDue);
    if (!queue.length) {
      openModal(room.name + " reset", emptyState("No room reset tasks are waiting. This room is allowed to rest."));
      return;
    }
    var task = queue[0];
    openModal(room.name + " reset", "<div class=\"stack\"><p>One step at a time. Stop whenever you have done enough.</p>" + renderTaskCard(task, { compact: true, highlight: true }) + "<div class=\"form-actions\"><button class=\"primary\" type=\"button\" data-action=\"reset-complete\" data-id=\"" + room.id + "\" data-task=\"" + task.id + "\">Done and next</button><button type=\"button\" data-action=\"reset-skip\" data-id=\"" + room.id + "\" data-task=\"" + task.id + "\">Skip and next</button><button type=\"button\" data-action=\"reset-next\" data-id=\"" + room.id + "\" data-skipid=\"" + task.id + "\">Show another</button><button type=\"button\" data-action=\"modal-close\">Stop</button></div></div>");
  }

  function openModal(title, body) {
    modalRoot.innerHTML = "<div class=\"modal-backdrop\"><div class=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"modal-title\"><div class=\"modal-header\"><h2 id=\"modal-title\">" + escapeHtml(title) + "</h2><button class=\"icon-button\" type=\"button\" data-action=\"modal-close\" aria-label=\"Close\">×</button></div><div class=\"modal-body\">" + body + "</div></div></div>";
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function pickOneThing() {
    var task = recommendedTasks(1)[0] || visibleTasks().filter(function (item) { return getTaskStatus(item).bucket !== "paused"; }).sort(sortByPriorityThenMinutes)[0];
    if (!task) {
      showToast("No task is waiting right now.");
      return;
    }
    ui.oneThingId = task.id;
    ui.tab = "today";
    render();
    showToast("Try this one: " + task.title + ".");
  }

  function bulkAction(type) {
    var ids = Array.from(ui.selectedTaskIds);
    if (!ids.length) return;
    if (type === "complete") ids.forEach(function (id) { completeTask(id, false, true); });
    if (type === "snooze") ids.forEach(function (id) { var task = getTask(id); if (task) task.snoozeDate = addDays(todayKey(), 1); });
    if (type === "skip") ids.forEach(function (id) { skipTask(id, true); });
    if (type === "snooze") {
      ids.forEach(function (id) {
        var task = getTask(id);
        if (task) state.history.push({ id: makeId("history"), taskId: task.id, roomId: task.roomId, type: "snoozed", date: new Date().toISOString(), note: "Bulk snoozed until tomorrow", dueDate: task.nextDueDate, nextDueDate: task.snoozeDate });
      });
      saveState();
    }
    ui.selectedTaskIds.clear();
    render();
    showToast(type === "complete" ? "Selected tasks completed." : type === "skip" ? "Selected tasks skipped once." : "Selected tasks snoozed until tomorrow.");
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "little-reset-backup-" + todayKey() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = migrateState(JSON.parse(String(reader.result || "")));
        validateImportedState(imported);
        if (!confirm("Import this backup and replace current local data?")) return;
        state = imported;
        saveState();
        ui.selectedTaskIds.clear();
        ui.selectedRoomId = null;
        closeModal();
        render();
        showToast("Backup imported.");
      } catch (error) {
        alert("That file does not look like a compatible Little Reset backup.");
      }
    };
    reader.readAsText(file);
  }

  function validateImportedState(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid backup");
    if (!Array.isArray(data.rooms) || !Array.isArray(data.tasks) || !Array.isArray(data.history)) throw new Error("Missing data arrays");
    data.rooms.forEach(function (room) { if (!room.id || !room.name) throw new Error("Invalid room"); });
    data.tasks.forEach(function (task) { if (!task.id || !task.title || !task.roomId) throw new Error("Invalid task"); });
  }

  function resetSampleData() {
    if (!confirm("Reset to sample data? This replaces the local app data in this browser.")) return;
    state = createSampleState();
    saveState();
    ui.selectedTaskIds.clear();
    ui.selectedRoomId = null;
    render();
    showToast("Sample data restored.");
  }

  function recommendedTasks(limit) {
    var mode = state.settings.energyMode || "normal";
    return visibleTasks().filter(function (task) {
      var bucket = getTaskStatus(task).bucket;
      if (!(bucket === "overdue" || bucket === "today" || task.estimatedMinutes <= 10)) return false;
      if (mode === "low") return task.effort === "low" && task.estimatedMinutes <= 10;
      if (mode === "deep") return task.taskType === "deep-clean" || task.effort === "high" || task.priority === "high";
      return task.effort !== "high" || task.estimatedMinutes <= 15;
    }).sort(sortRecommended).slice(0, limit);
  }

  function filteredTasks() {
    var filters = ui.filters;
    var query = String(filters.search || "").trim().toLowerCase();
    var tasks = visibleTasks().filter(function (task) {
      var room = getRoom(task.roomId);
      var haystack = [task.title, task.description, room ? room.name : "", (task.tags || []).join(" ")].join(" ").toLowerCase();
      if (query && haystack.indexOf(query) === -1) return false;
      if (filters.room !== "all" && task.roomId !== filters.room) return false;
      if (filters.due !== "all" && getTaskStatus(task).bucket !== filters.due) return false;
      if (filters.effort !== "all" && task.effort !== filters.effort) return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      if (filters.frequency !== "all" && task.frequencyType !== filters.frequency) return false;
      if (filters.tag !== "all" && (task.tags || []).indexOf(filters.tag) === -1) return false;
      return true;
    });
    return tasks.sort(sortForFilter(filters.sort));
  }

  function visibleTasks() {
    var roomIds = activeRooms().map(function (room) { return room.id; });
    return state.tasks.filter(function (task) { return task.status !== "archived" && roomIds.indexOf(task.roomId) >= 0; });
  }

  function activeRooms() {
    return state.rooms.filter(function (room) { return !room.archived; }).sort(sortRooms);
  }

  function getRoomSnapshot(roomId) {
    var tasks = visibleTasks().filter(function (task) { return task.roomId === roomId; });
    var overdue = tasks.filter(function (task) { return getTaskStatus(task).bucket === "overdue"; }).sort(sortByDue);
    var today = tasks.filter(function (task) { return getTaskStatus(task).bucket === "today"; }).sort(sortByDue);
    var upcoming = tasks.filter(function (task) { return getTaskStatus(task).bucket === "upcoming" || getTaskStatus(task).bucket === "later"; }).sort(sortByDue);
    var recent = tasks.filter(function (task) { return task.lastCompletedDate && compareDates(task.lastCompletedDate, offsetDate(-14)) >= 0; }).sort(function (a, b) { return compareDates(b.lastCompletedDate, a.lastCompletedDate); });
    var health = Math.max(0, Math.min(100, 94 - overdue.length * 18 - today.length * 8 + recent.length * 4));
    var label = health >= 82 ? "Fresh and steady" : health >= 58 ? "Mostly maintained" : health >= 34 ? "Needs a little reset" : "Asking for attention";
    return { overdue: overdue, today: today, upcoming: upcoming, recent: recent, health: health, label: label };
  }

  function getTaskStatus(task) {
    if (task.status === "archived") return { bucket: "done", label: "Archived", tone: "" };
    if (task.status === "completed" && task.frequencyType === "one-time") return { bucket: "done", label: "Done", tone: "sage" };
    if (task.seasonalPaused || task.frequencyType === "seasonal") return { bucket: "paused", label: "Paused", tone: "blue" };
    if (task.frequencyType === "as-needed") return { bucket: "paused", label: "As needed", tone: "blue" };
    var due = effectiveDueDate(task);
    if (!due) return { bucket: "later", label: "No date", tone: "" };
    var diff = dateDiff(todayKey(), due);
    if (diff < 0) return { bucket: "overdue", label: Math.abs(diff) + " day" + (Math.abs(diff) === 1 ? "" : "s") + " overdue", tone: "rose" };
    if (diff === 0) return { bucket: "today", label: "Due today", tone: "gold" };
    if (diff <= 7) return { bucket: "upcoming", label: "Due " + formatDate(due), tone: "blue" };
    return { bucket: "later", label: "Due " + formatDate(due), tone: "" };
  }

  function effectiveDueDate(task) {
    if (task.snoozeDate && compareDates(task.snoozeDate, todayKey()) >= 0) return task.snoozeDate;
    return task.nextDueDate || null;
  }

  function calculateNextDueDate(task, fromDate) {
    var base = fromDate || todayKey();
    var interval = Math.max(1, Number(task.frequencyInterval) || 1);
    if (task.frequencyType === "daily") return addDays(base, 1);
    if (task.frequencyType === "every-days") return addDays(base, interval);
    if (task.frequencyType === "weekly") return addDays(base, 7);
    if (task.frequencyType === "every-weeks") return addDays(base, interval * 7);
    if (task.frequencyType === "monthly") return addMonths(base, 1);
    if (task.frequencyType === "every-months") return addMonths(base, interval);
    if (task.frequencyType === "weekdays") return nextWeekdayAfter(base, task.weekdays || []);
    if (task.frequencyType === "one-time" || task.frequencyType === "as-needed" || task.frequencyType === "seasonal") return null;
    return addDays(base, 7);
  }

  function nextWeekdayAfter(baseKey, weekdays) {
    if (!weekdays.length) return addDays(baseKey, 7);
    for (var i = 1; i <= 14; i++) {
      var candidate = addDays(baseKey, i);
      if (weekdays.indexOf(parseDateKey(candidate).getDay()) >= 0) return candidate;
    }
    return addDays(baseKey, 7);
  }

  function completedHistorySince(startKey, days) {
    var endKey = addDays(startKey, days - 1);
    return state.history.filter(function (entry) {
      var key = dateOnly(entry.date);
      return entry.type === "completed" && compareDates(key, startKey) >= 0 && compareDates(key, endKey) <= 0;
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function getTodaySummaryText() {
    var tasks = visibleTasks();
    var overdue = tasks.filter(function (task) { return getTaskStatus(task).bucket === "overdue"; }).length;
    var due = tasks.filter(function (task) { return getTaskStatus(task).bucket === "today"; }).length;
    var done = state && state.history ? state.history.filter(function (entry) { return entry.type === "completed" && dateOnly(entry.date) === todayKey(); }).length : 0;
    if (done) return done + " small reset" + (done === 1 ? "" : "s") + " done today.";
    if (overdue) return overdue + " task" + (overdue === 1 ? "" : "s") + " waiting kindly.";
    if (due) return due + " tiny reset" + (due === 1 ? "" : "s") + " due today.";
    return "A calm home plan for small resets.";
  }

  function sortRecommended(a, b) {
    var statusScore = { overdue: 0, today: 1, upcoming: 2, later: 3, paused: 4, done: 5 };
    var aStatus = getTaskStatus(a).bucket;
    var bStatus = getTaskStatus(b).bucket;
    if (statusScore[aStatus] !== statusScore[bStatus]) return statusScore[aStatus] - statusScore[bStatus];
    if (priorityScore(b.priority) !== priorityScore(a.priority)) return priorityScore(b.priority) - priorityScore(a.priority);
    if (a.estimatedMinutes !== b.estimatedMinutes) return a.estimatedMinutes - b.estimatedMinutes;
    return sortByDue(a, b);
  }

  function sortByPriorityThenMinutes(a, b) {
    if (priorityScore(b.priority) !== priorityScore(a.priority)) return priorityScore(b.priority) - priorityScore(a.priority);
    return a.estimatedMinutes - b.estimatedMinutes;
  }

  function sortByDue(a, b) {
    var aDue = effectiveDueDate(a) || "9999-12-31";
    var bDue = effectiveDueDate(b) || "9999-12-31";
    var compare = compareDates(aDue, bDue);
    if (compare !== 0) return compare;
    return a.estimatedMinutes - b.estimatedMinutes;
  }

  function sortForFilter(sort) {
    if (sort === "most-overdue") return sortByDue;
    if (sort === "shortest") return function (a, b) { return a.estimatedMinutes - b.estimatedMinutes || sortByDue(a, b); };
    if (sort === "room-order") return function (a, b) { return roomOrder(a.roomId) - roomOrder(b.roomId) || sortByDue(a, b); };
    if (sort === "priority") return sortByPriorityThenMinutes;
    return sortByDue;
  }

  function sortRooms(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name);
  }

  function priorityScore(priority) {
    if (priority === "high") return 3;
    if (priority === "normal") return 2;
    return 1;
  }

  function roomOrder(roomId) {
    var room = getRoom(roomId);
    return room ? Number(room.sortOrder || 0) : 999;
  }

  function allTags() {
    var tags = [];
    state.tasks.forEach(function (task) {
      (task.tags || []).forEach(function (tag) {
        if (tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    return tags.sort();
  }

  function getRoom(id) {
    return state.rooms.find(function (room) { return room.id === id; });
  }

  function getTask(id) {
    return state.tasks.find(function (task) { return task.id === id; });
  }

  function nextRoomSortOrder() {
    return state.rooms.reduce(function (max, room) { return Math.max(max, Number(room.sortOrder || 0)); }, 0) + 1;
  }

  function applySettings() {
    if (!state) return;
    document.documentElement.style.setProperty("--accent", state.settings.accentColor || "#8d7661");
    document.body.classList.toggle("compact", !!state.settings.compactMode);
    var theme = document.querySelector("meta[name='theme-color']");
    if (theme) theme.setAttribute("content", state.settings.accentColor || "#8d7661");
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  function breakdownRow(label, count, percent) {
    return "<div class=\"breakdown-row\"><span>" + escapeHtml(label) + "</span><div class=\"breakdown-bar\" style=\"--amount:" + percent + "%\"><span></span></div><strong>" + count + "</strong></div>";
  }

  function typeLabel(type) {
    var match = TASK_TYPES.find(function (item) { return item.value === type; });
    return match ? match.label : "Task";
  }

  function formatFrequency(task) {
    var interval = Math.max(1, Number(task.frequencyInterval) || 1);
    if (task.frequencyType === "daily") return "Daily";
    if (task.frequencyType === "every-days") return "Every " + interval + " day" + (interval === 1 ? "" : "s");
    if (task.frequencyType === "weekly") return "Weekly";
    if (task.frequencyType === "every-weeks") return "Every " + interval + " week" + (interval === 1 ? "" : "s");
    if (task.frequencyType === "monthly") return "Monthly";
    if (task.frequencyType === "every-months") return "Every " + interval + " month" + (interval === 1 ? "" : "s");
    if (task.frequencyType === "weekdays") return "Specific weekdays";
    if (task.frequencyType === "seasonal") return "Seasonal / paused";
    if (task.frequencyType === "one-time") return "One-time";
    if (task.frequencyType === "as-needed") return "As needed";
    return "Recurring";
  }

  function formatDate(key) {
    if (!key) return "No date";
    return parseDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function shortDateLabel(key, days) {
    var date = parseDateKey(key);
    if (days <= 7) return date.toLocaleDateString(undefined, { weekday: "short" });
    return String(date.getMonth() + 1) + "/" + date.getDate();
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  function offsetDate(offset) {
    return addDays(todayKey(), offset);
  }

  function toDateKey(date) {
    var value = new Date(date);
    value.setHours(0, 0, 0, 0);
    var month = String(value.getMonth() + 1).padStart(2, "0");
    var day = String(value.getDate()).padStart(2, "0");
    return value.getFullYear() + "-" + month + "-" + day;
  }

  function dateOnly(value) {
    if (!value) return null;
    if (String(value).indexOf("T") > -1) return toDateKey(new Date(value));
    return String(value).slice(0, 10);
  }

  function parseDateKey(key) {
    var parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(key, days) {
    var date = parseDateKey(key);
    date.setDate(date.getDate() + Number(days || 0));
    return toDateKey(date);
  }

  function addMonths(key, months) {
    var date = parseDateKey(key);
    var day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + Number(months || 0));
    var last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    return toDateKey(date);
  }

  function compareDates(a, b) {
    return parseDateKey(a).getTime() - parseDateKey(b).getTime();
  }

  function dateDiff(startKey, endKey) {
    return Math.round((parseDateKey(endKey).getTime() - parseDateKey(startKey).getTime()) / MS_PER_DAY);
  }

  function makeId(prefix) {
    return String(prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function splitTags(value) {
    return String(value || "").split(",").map(function (tag) { return tag.trim().toLowerCase(); }).filter(Boolean).filter(function (tag, index, list) { return list.indexOf(tag) === index; });
  }

  function slugify(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function capitalize(value) {
    value = String(value || "");
    return value.charAt(0).toUpperCase() + value.slice(1).replace("-", " ");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>\"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#039;");
  }
})();
