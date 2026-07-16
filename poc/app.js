const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const stateKey = "chapelSchedulerPocState";
const defaultState = { confirmed: false, volunteered: false, published: false, proposalSaved: false };
let state = { ...defaultState, ...JSON.parse(localStorage.getItem(stateKey) || "{}") };

const tourSteps = [
  { role: 'public', route: 'calendar', mode: 'public', audience: 'Public experience', title: 'Start with the public calendar', script: 'Anyone can check Mass times without signing in. No volunteer or restricted-calendar information is exposed.', action: 'Show the public services, then select Get updates or volunteer.', quote: '“The calendar remains public; an account is an optional way to stay connected.”' },
  { role: 'signup', route: 'signup', audience: 'New visitor', title: 'Turn interest into participation', script: 'A verified email unlocks opt-in updates and a low-pressure invitation to help. Nothing is preselected, and a name is requested only after volunteering.', action: 'Choose an update, select one way to help, and finish the fictional registration.', quote: '“We make opportunities visible without turning registration into a commitment.”' },
  { role: 'volunteer', route: 'calendar', mode: 'ministry', audience: 'Approved volunteer', title: 'Reveal the ministry layer', script: 'After approval, the same calendar adds only the member’s relevant ministry openings and assignments.', action: 'Toggle Public and Ministry to make the permission boundary visible.', quote: '“The calendar becomes more useful after sign-in without exposing unrelated ministries.”' },
  { role: 'volunteer', route: 'my-schedule', audience: 'Approved volunteer', title: 'Confirm and manage assignments', script: 'The member sees pending and confirmed services and confirms the service—not a preferred position.', action: 'Confirm September 5, then open Need a substitute on September 6.', quote: '“The member stays responsible until a qualified substitute accepts.”' },
  { role: 'volunteer', route: 'availability', audience: 'Approved volunteer', title: 'Capture preferences without friction', script: 'Simple recurring choices and dated absences give the scheduler the information MSP currently lacks.', action: 'Change one preference and add the fictional September 18–20 absence.', quote: '“Members can do this on the website or through the Telegram bot.”' },
  { role: 'volunteer', route: 'telegram', audience: 'Telegram member', title: 'Explain group versus private bot', script: 'The Chats list contains both the ministry group and Chapel Scheduler bot, but they serve different purposes.', action: 'Select the group for announcements, then the bot for personal actions.', quote: '“General openings go to the group; personal schedules and absences stay in the private bot chat.”' },
  { role: 'leader', route: 'leader', audience: 'Ministry leader', title: 'Review before automation acts', script: 'The scheduler creates a draft, surfaces shortages and conflicts, and waits for leader approval before notifying volunteers.', action: 'Suggest a candidate, resolve the cross-ministry conflict, and publish.', quote: '“Automation saves work, but the ministry leader remains in control.”' },
  { role: 'assistant', route: 'calendar', mode: 'father', audience: "Father's assistant", title: 'Show restricted monthly context', script: 'An approved delegate sees public services and Father’s protected appointments together. Ministry staffing is not mixed into this view.', action: 'Compare Public and Father’s restricted, then open Father’s calendar for the weekly detail.', quote: '“Unauthorized users do not see a locked tab—they do not know the private calendar exists.”' },
  { role: 'assistant', route: 'assistant', audience: "Father's assistant", title: 'Schedule privately and safely', script: 'Plain language handles generic category, date, and time. Names and minimal notes are entered in a separate protected window.', action: 'Interpret the Pre-Cana request and open Add protected details.', quote: '“Sensitive fields stay inside Chapel Scheduler and are not sent to the AI provider.”' },
  { role: 'assistant', route: 'father-calendar', audience: 'Permissions review', title: 'Finish with the permission model', script: 'The weekly calendar shows the authorized delegate experience and explains what administrators, ministry users, and the public see.', action: 'Review the Who sees what panel and invite stakeholder questions.', quote: '“Access follows a person’s job. Main administrator does not automatically mean private-calendar access.”' }
];
let tourIndex = 0;

const publicServiceNotes = {
  "fri-4": "Confessions · 5:30 p.m. · English & Spanish | Rosary · 5:30 p.m.",
  "sat-5": "Confessions · 8:00 a.m. · English & Spanish | Rosary · 8:00 a.m.",
  "sun-6-7": "Confessions · 6:30 a.m. · English & Spanish | Rosary · 6:30 a.m.",
  "sun-6-9": "Confessions · 8:30 a.m. · English & Spanish | Rosary · 8:30 a.m.",
  "sun-6-11": "Confessions · 10:30 a.m. · English & Spanish | Rosary · 10:30 a.m.",
  "sun-6-5": "Confessions · 4:30 p.m. · English & Spanish | Rosary · 4:30 p.m.",
  "mon-7": "Confessions · 6:15 a.m. · English & Spanish | Rosary · 6:15 a.m.",
  "fri-11": "Confessions · 5:30 p.m. · English & Spanish | Rosary · 5:30 p.m.",
  "sat-12": "Confessions · 8:00 a.m. · English & Spanish | Rosary · 8:00 a.m.",
  "sun-13-7": "Confessions · 6:30 a.m. · English & Spanish | Rosary · 6:30 a.m.",
  "sun-13-11": "Confessions · 10:30 a.m. · English & Spanish | Rosary · 10:30 a.m.",
  "mon-14": "Confessions · 6:15 a.m. · English & Spanish | Rosary · 6:15 a.m.",
  "fri-18": "Confessions · 5:30 p.m. · English & Spanish | Rosary · 5:30 p.m.",
  "sat-19": "Confessions · 8:00 a.m. · English & Spanish | Rosary · 8:00 a.m.",
  "sun-20": "Confessions · 10:30 a.m. · English & Spanish | Rosary · 10:30 a.m.",
  "mon-21": "Confessions · 6:15 a.m. · English & Spanish | Rosary · 6:15 a.m.",
  "fri-25": "Confessions · 5:30 p.m. · English & Spanish | Rosary · 5:30 p.m.",
  "sat-26": "Confessions · 8:00 a.m. · English & Spanish | Rosary · 8:00 a.m.",
  "sun-27": "Confessions · 8:30 a.m. · English & Spanish | Rosary · 8:30 a.m.",
  "mon-28": "Confessions · 6:15 a.m. · English & Spanish | Rosary · 6:15 a.m."
};

$$('.event[data-event]').forEach(event => {
  const note = publicServiceNotes[event.dataset.event];
  if (!note) return;
  const line = document.createElement('small');
  line.className = 'public-service-note';
  line.textContent = note;
  event.append(line);
});

function saveState() { localStorage.setItem(stateKey, JSON.stringify(state)); }
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}

function route() {
  const name = location.hash.replace("#", "") || "calendar";
  const role = $("#role-select").value;
  const permitted = role === "leader" ? ["leader"] : role === "assistant" ? ["assistant"] : [];
  const memberOnly = ["my-schedule", "availability", "telegram", "documents"];
  const target = role === "signup" ? "signup" : (name === "leader" && !permitted.includes("leader")) ||
    (["assistant", "father-calendar"].includes(name) && !permitted.includes("assistant")) ||
    (role === "public" && memberOnly.includes(name)) ? "calendar" : name;
  $$(".view").forEach(view => view.hidden = view.dataset.view !== target);
  $$("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === target));
  $("#main-content").focus({ preventScroll: true });
}

function applyRole() {
  const role = $("#role-select").value;
  document.body.classList.toggle("public-mode", role === "public");
  $$('[data-role="leader"]').forEach(el => el.hidden = role !== "leader");
  $$('[data-role="assistant"]').forEach(el => el.hidden = role !== "assistant");
  if ((location.hash === "#leader" && role !== "leader") || (location.hash === "#assistant" && role !== "assistant")) location.hash = "calendar";
  if (role === "signup") location.hash = "signup";
  setCalendarMode(role === "public" ? "public" : role === "assistant" ? "father" : "ministry");
  renderTelegram(role);
  route();
}

function setCalendarMode(mode) {
  const role = $("#role-select").value;
  const allowed = {
    public: ["public"],
    volunteer: ["public", "ministry"],
    leader: ["public", "ministry"],
    assistant: ["public", "father"],
    signup: ["public"]
  };
  const safeMode = (allowed[role] || ["public"]).includes(mode) ? mode : "public";
  const calendar = $('[data-view="calendar"]');
  calendar.classList.toggle('calendar-public-preview', safeMode === 'public');
  calendar.classList.toggle('calendar-father-preview', safeMode === 'father');
  $$('[data-calendar-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.calendarMode === safeMode);
    button.hidden = !(allowed[role] || ["public"]).includes(button.dataset.calendarMode);
    button.disabled = false;
  });
  $('#calendar-permission-toggle').hidden = (allowed[role] || ["public"]).length < 2;
  const explainer = $('#calendar-access-explainer');
  explainer.classList.toggle('public-preview', safeMode === 'public');
  $('.access-icon', explainer).textContent = safeMode === 'public' ? '◉' : safeMode === 'ministry' ? '◇' : '⌾';
  const copy = {
    public: ['Public calendar', 'Masses, public services, liturgical titles, Confessions, Rosary, location, and public celebrant information are visible. No volunteer information is shown.'],
    ministry: ['Ministry calendar', 'Approved members see openings and assignments only for ministries to which they belong. Father’s private appointments remain hidden.'],
    father: ["Father’s restricted calendar", 'Father and personally approved delegates see public services together with protected appointments. Volunteer staffing remains hidden in this view.']
  }[safeMode];
  $('strong', explainer).textContent = copy[0];
  $('p', explainer).textContent = copy[1];
}

$$('[data-calendar-mode]').forEach(button => button.addEventListener('click', () => setCalendarMode(button.dataset.calendarMode)));

function renderState() {
  if (state.confirmed) {
    const card = $("#pending-assignment");
    $(".status", card).textContent = "Confirmed";
    $(".status", card).className = "status confirmed";
    $("#confirm-assignment").remove();
    $("#pending-count").textContent = "0";
  }
  if (state.volunteered) {
    const button = $("#volunteer-button");
    button.textContent = "Volunteer request received";
    button.disabled = true;
  }
  if (state.published) $("#publish-draft").textContent = "Published";
  if (state.proposalSaved) {
    $("#save-proposal").textContent = "Saved to private calendar";
    $("#save-proposal").disabled = true;
  }
}

window.addEventListener("hashchange", route);
$("#role-select").addEventListener("change", applyRole);
$("#reset-demo").addEventListener("click", () => { localStorage.removeItem(stateKey); location.reload(); });
$("#tour-launch").addEventListener("click", () => { tourIndex = 0; $("#tour-panel").hidden = false; runTourStep(); });
$("#tour-close").addEventListener("click", () => $("#tour-panel").hidden = true);
$("#tour-back").addEventListener("click", () => { if (tourIndex > 0) { tourIndex -= 1; runTourStep(); } });
$("#tour-next").addEventListener("click", () => {
  if (tourIndex === tourSteps.length - 1) { $("#tour-panel").hidden = true; toast('Guided demo complete. The POC remains available for questions.'); return; }
  tourIndex += 1; runTourStep();
});

const tourPanel = $("#tour-panel");
const tourHandle = $(".tour-panel-head", tourPanel);
let tourDrag = null;
tourHandle.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  const rect = tourPanel.getBoundingClientRect();
  tourDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  tourPanel.style.left = `${rect.left}px`;
  tourPanel.style.top = `${rect.top}px`;
  tourPanel.style.right = 'auto';
  tourPanel.style.bottom = 'auto';
  tourPanel.classList.add('dragging');
  tourHandle.setPointerCapture(event.pointerId);
});
tourHandle.addEventListener('pointermove', event => {
  if (!tourDrag) return;
  const maxLeft = Math.max(7, window.innerWidth - tourPanel.offsetWidth - 7);
  const maxTop = Math.max(7, window.innerHeight - tourPanel.offsetHeight - 7);
  tourPanel.style.left = `${Math.min(maxLeft, Math.max(7, event.clientX - tourDrag.x))}px`;
  tourPanel.style.top = `${Math.min(maxTop, Math.max(7, event.clientY - tourDrag.y))}px`;
});
function endTourDrag(event) {
  if (!tourDrag) return;
  tourDrag = null;
  tourPanel.classList.remove('dragging');
  if (tourHandle.hasPointerCapture(event.pointerId)) tourHandle.releasePointerCapture(event.pointerId);
}
tourHandle.addEventListener('pointerup', endTourDrag);
tourHandle.addEventListener('pointercancel', endTourDrag);

function runTourStep() {
  $$('dialog[open]').forEach(dialog => dialog.close());
  const step = tourSteps[tourIndex];
  $("#role-select").value = step.role;
  applyRole();
  location.hash = step.route;
  if (step.mode) setCalendarMode(step.mode);
  $("#tour-progress").textContent = `${tourIndex + 1} of ${tourSteps.length}`;
  $("#tour-audience").textContent = step.audience;
  $("#tour-title").textContent = step.title;
  $("#tour-script").textContent = step.script;
  $("#tour-action span").textContent = step.action;
  $("#tour-quote").textContent = step.quote;
  $("#tour-back").disabled = tourIndex === 0;
  $("#tour-next").textContent = tourIndex === tourSteps.length - 1 ? 'Finish' : 'Next';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$("#print-button").addEventListener("click", () => window.print());

$$('.segmented button').forEach(button => button.addEventListener("click", () => {
  $$('.segmented button').forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  if (button.textContent !== "Month") toast(`${button.textContent} view is represented in the full design; this POC demonstrates Month view.`);
}));

$$('.event').forEach(event => event.addEventListener("click", () => $("#event-dialog").showModal()));
$$('.dialog-close, .dialog-cancel').forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));

$("#volunteer-button").addEventListener("click", () => {
  state.volunteered = true; saveState(); renderState(); $("#event-dialog").close();
  toast("You volunteered. The ministry leader will review the opening.");
});

$("#confirm-assignment").addEventListener("click", event => {
  state.confirmed = true; saveState();
  const card = event.target.closest(".assignment-card");
  $(".status", card).textContent = "Confirmed"; $(".status", card).className = "status confirmed";
  event.target.remove(); $("#pending-count").textContent = "0";
  toast("Assignment confirmed. Your private calendar feed would update automatically.");
});

$$('.need-sub').forEach(button => button.addEventListener("click", () => $("#sub-dialog").showModal()));
$("#submit-sub").addEventListener("click", () => {
  const selected = $('input[name="substitute"]:checked');
  if (!selected) return toast("Select a qualified member to contact.");
  const shortName = selected.value.split(' ')[0];
  $("#sub-sent-title").textContent = `${shortName} has been contacted`;
  $("#sub-sent-member").textContent = `${selected.value} · awaiting response`;
  $("#sub-dialog").close();
  $("#sub-sent-dialog").showModal();
});
$(".dialog-close-action").addEventListener("click", () => { $("#sub-sent-dialog").close(); toast("Substitute request is active. You remain assigned until acceptance."); });

$$('.choice button').forEach(button => button.addEventListener("click", () => {
  $$('button', button.closest('.choice')).forEach(item => item.classList.remove('selected', 'danger'));
  button.classList.add('selected');
  if (button.textContent.includes('Do not')) button.classList.add('danger');
}));
$('.save-preferences').addEventListener('click', () => toast('Preferences saved for the next scheduling run.'));

$("#absence-form").addEventListener("submit", event => {
  event.preventDefault();
  const from = new Date($("#absence-from").value + "T12:00:00");
  const to = new Date($("#absence-to").value + "T12:00:00");
  const format = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const li = document.createElement("li");
  li.innerHTML = `<span><strong>${format(from)}–${format(to)}</strong><small>${$("#absence-note").value || "Unavailable"}</small></span><button aria-label="Remove absence">×</button>`;
  $("#absence-list").append(li); li.querySelector("button").addEventListener("click", () => li.remove());
  toast("Absence added. The bot would repeat these exact dates for confirmation.");
});
$$('#absence-list button').forEach(button => button.addEventListener('click', () => button.closest('li').remove()));

$$('.suggest').forEach(button => button.addEventListener('click', () => {
  const row = button.closest('tr'); const select = $('select', row); select.value = 'David R.';
  $('.status', row).textContent = 'Suggested'; $('.status', row).className = 'status review';
  toast('Suggested David R. based on availability and adjusted workload.');
}));
$$('.resolve').forEach(button => button.addEventListener('click', () => {
  const row = button.closest('tr'); row.classList.remove('conflict-row'); $('select', row).value = 'Joseph T.';
  $('.status', row).textContent = 'Ready'; $('.status', row).className = 'status ready';
  toast('Conflict resolved. David is no longer double-scheduled.');
}));
$("#publish-draft").addEventListener("click", event => {
  state.published = true; saveState(); event.target.textContent = "Published";
  toast("Schedule published. Confirmation requests would go by email and Telegram.");
});

$("#assistant-form").addEventListener("submit", event => {
  event.preventDefault(); $("#sample-request").textContent = $("#assistant-input").value;
  toast("Request interpreted. Review the structured proposal before saving.");
});

$("#open-protected").addEventListener("click", () => $("#protected-dialog").showModal());
$("#protected-form").addEventListener("submit", event => {
  event.preventDefault();
  const hasName = $("#protected-name").value.trim().length > 0;
  const hasNote = $("#protected-note").value.trim().length > 0;
  const parts = [hasName ? "name added" : null, hasNote ? "minimal note added" : null].filter(Boolean);
  $("#protected-summary-text").textContent = parts.length ? `${parts.join(" · ")} · stored privately` : "No name or private note added";
  $("#protected-dialog").close();
  toast("Protected details saved separately from the plain-language request.");
});

let signupStage = 0;
function renderSignupStage() {
  $$('.signup-stage').forEach(stage => stage.hidden = Number(stage.dataset.signupStage) !== signupStage);
  $$('#signup-steps li').forEach((step, index) => {
    step.classList.toggle('active', index === signupStage);
    step.classList.toggle('done', index < signupStage);
  });
}
function beginSignupDemo() {
  signupStage = 0;
  renderSignupStage();
  $("#role-select").value = "signup";
  applyRole();
  location.hash = "signup";
}
$("#start-signup").addEventListener("click", beginSignupDemo);
$$('.public-opportunity-link').forEach(link => link.addEventListener('click', beginSignupDemo));
$$('input[name="volunteer-interest"]').forEach(input => input.addEventListener('change', () => {
  const hasInterest = $$('input[name="volunteer-interest"]').some(option => option.checked);
  $('#volunteer-name').hidden = !hasInterest;
  $$('#volunteer-name input').forEach(field => field.required = hasInterest);
}));
$$('.signup-next').forEach(button => button.closest('form').addEventListener('submit', event => {
  event.preventDefault(); signupStage += 1; renderSignupStage();
  if (signupStage === 1) toast('Email verified through a simulated one-time link.');
}));
$$('.signup-back').forEach(button => button.addEventListener('click', () => { signupStage = Math.max(0, signupStage - 1); renderSignupStage(); }));
$("#complete-signup").closest('form').addEventListener('submit', event => {
  event.preventDefault(); signupStage = 4; renderSignupStage(); toast('Fictional notification account created. No real messages were sent.');
});
$("#finish-signup-demo").addEventListener('click', () => { $("#role-select").value = 'public'; location.hash = 'calendar'; applyRole(); toast('The public calendar remains available without signing in.'); });

function addTelegramMessage(text, direction = "outgoing") {
  const message = document.createElement("div");
  message.className = `tg-message ${direction}`;
  message.innerHTML = `<p>${text}</p><small>now</small>`;
  $("#bot-thread").append(message);
  $("#bot-thread").scrollTop = $("#bot-thread").scrollHeight;
}

const telegramPersonas = {
  volunteer: {
    groupName: "OLV Sacristans",
    groupStatus: "8 members",
    group: `<div class="telegram-date">Today</div>
      <div class="tg-message incoming"><b>Chapel Scheduler Bot</b><p><strong>Daily sacristan openings</strong></p><p>Friday Sep 4 · 6:30 p.m.</p><p>Saturday Sep 12 · 9:00 a.m.</p><small>8:00 AM</small></div>
      <div class="tg-message incoming urgent"><b>Chapel Scheduler Bot</b><p><strong>Urgent substitute needed</strong></p><p>Sunday Sep 6 · 9:00 a.m.</p><p>Reply privately to volunteer.</p><small>10:17 AM</small></div>`,
    privateName: "Chapel Scheduler",
    privateStatus: "bot · Michael's private chat",
    private: `<div class="telegram-date">Today</div><div class="tg-message incoming"><p>Hello Michael. Your Telegram account is securely linked to Chapel Scheduler.</p><p>What would you like to do?</p><small>9:41 AM</small></div>`,
    replies: [["openings", "Show openings"], ["absence", "Report absence"], ["schedule", "My schedule"]]
  },
  leader: {
    groupName: "OLV Ministry Leaders",
    groupStatus: "5 members",
    group: `<div class="telegram-date">Today</div>
      <div class="tg-message incoming"><b>Chapel Scheduler Bot</b><p><strong>Morning staffing summary</strong></p><p>Sacristans: 2 openings</p><p>Altar servers: 3 openings</p><p>Ushers: 1 urgent substitute</p><small>8:00 AM</small></div>
      <div class="tg-message incoming urgent"><b>Chapel Scheduler Bot</b><p><strong>Leader attention needed</strong></p><p>Sunday Sep 6 · 11:00 a.m.</p><p>Cross-ministry conflict in draft.</p><small>8:02 AM</small></div>`,
    privateName: "Chapel Scheduler · Leader",
    privateStatus: "bot · private management chat",
    private: `<div class="telegram-date">Today</div><div class="tg-message incoming"><p>Good morning. The sacristan draft has <strong>2 openings</strong>, <strong>1 conflict</strong>, and <strong>3 unconfirmed assignments</strong>.</p><small>9:41 AM</small></div>`,
    replies: [["leader-draft", "Review draft"], ["leader-unconfirmed", "Unconfirmed"], ["leader-urgent", "Urgent openings"]]
  },
  assistant: {
    groupName: "OLV Scheduling Staff",
    groupStatus: "3 members",
    group: `<div class="telegram-date">Today</div>
      <div class="tg-message incoming"><b>Chapel Scheduler Bot</b><p><strong>Calendar update</strong></p><p>Funeral Mass added</p><p>Thu Sep 10 · 10:00 a.m.</p><p>Ministry leaders have been alerted.</p><small>9:12 AM</small></div>
      <div class="tg-message incoming"><b>Chapel Scheduler Bot</b><p>Friday Sep 11 Mass changed to 7:00 p.m. Assigned volunteers acknowledged the update.</p><small>11:03 AM</small></div>`,
    privateName: "Chapel Scheduling Bot",
    privateStatus: "bot · public services only",
    private: `<div class="telegram-date">Today</div><div class="tg-message incoming"><p>You may create ordinary public services here. Use the secure website for Father's private appointments.</p><small>9:41 AM</small></div>`,
    replies: [["assistant-add", "Add public service"], ["assistant-changes", "Recent changes"], ["assistant-conflicts", "Check conflicts"]]
  }
};

function renderTelegram(role) {
  if (role === "public") return;
  const persona = telegramPersonas[role] || telegramPersonas.volunteer;
  $("#telegram-group-name").textContent = persona.groupName;
  $("#telegram-group-status").textContent = persona.groupStatus;
  $("#chat-list-group-name").textContent = persona.groupName;
  $("#chat-list-group-preview").textContent = role === 'leader' ? 'Morning staffing summary · 8:00 AM' : role === 'assistant' ? 'Calendar update · 9:12 AM' : 'Daily openings summary · 8:00 AM';
  $("#group-thread").innerHTML = persona.group;
  $("#telegram-private-name").textContent = persona.privateName;
  $("#telegram-private-status").textContent = persona.privateStatus;
  $("#chat-list-bot-name").textContent = persona.privateName;
  $("#chat-list-bot-preview").textContent = role === 'leader' ? 'Draft and confirmation alerts' : role === 'assistant' ? 'Public-service scheduling only' : 'Your private scheduling assistant';
  $("#bot-thread").innerHTML = persona.private;
  $("#quick-replies").innerHTML = persona.replies.map(([action, label]) => `<button data-bot-action="${action}">${label}</button>`).join("");
  $$('[data-bot-action]').forEach(button => button.addEventListener('click', () => runBotAction(button.dataset.botAction)));
}

$$('[data-open-chat]').forEach(button => button.addEventListener('click', () => {
  const phone = button.dataset.openChat === 'group' ? $('#group-phone') : $('#bot-phone');
  phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  phone.classList.remove('chat-highlight');
  requestAnimationFrame(() => phone.classList.add('chat-highlight'));
  toast(button.dataset.openChat === 'group' ? 'Opened the ministry announcement group.' : 'Opened the private Chapel Scheduler bot.');
}));

function runBotAction(action) {
  if (action === "openings") {
    addTelegramMessage("Show me open sacristan assignments");
    setTimeout(() => addTelegramMessage("<strong>Open sacristan assignments</strong><br>Fri Sep 4 · 6:30 p.m.<br>Sat Sep 12 · 9:00 a.m.<br><br>Reply with the service you want.", "incoming"), 250);
  } else if (action === "absence") {
    addTelegramMessage("I will be away September 18 through 20");
    setTimeout(() => addTelegramMessage("I understood: <strong>unavailable Friday, Sep 18 through Sunday, Sep 20, 2026</strong>.<br><br>Save this absence?", "incoming"), 250);
  } else if (action === "schedule") {
    addTelegramMessage("Show my schedule");
    setTimeout(() => addTelegramMessage("<strong>Your upcoming assignments</strong><br>Sat Sep 5 · 9:00 a.m. — needs confirmation<br>Sun Sep 6 · 7:00 a.m. — confirmed", "incoming"), 250);
  } else if (action === "leader-draft") {
    addTelegramMessage("Show the sacristan draft");
    setTimeout(() => addTelegramMessage("The draft has <strong>2 openings</strong> and <strong>1 cross-ministry conflict</strong>.<br><br>Open Chapel Scheduler to review assignments before publication.", "incoming"), 250);
  } else if (action === "leader-unconfirmed") {
    addTelegramMessage("Who has not confirmed?");
    setTimeout(() => addTelegramMessage("<strong>3 confirmations pending</strong><br>Michael S. · Sep 5<br>David R. · Sep 11<br>Thomas L. · Sep 14", "incoming"), 250);
  } else if (action === "leader-urgent") {
    addTelegramMessage("Show urgent openings");
    setTimeout(() => addTelegramMessage("<strong>Urgent</strong><br>Sunday Sep 6 · 9:00 a.m.<br>1 usher needed. Qualified available ushers have been notified.", "incoming"), 250);
  } else if (action === "assistant-add") {
    addTelegramMessage("Add a Funeral Mass Thursday September 10 at 10am");
    setTimeout(() => addTelegramMessage("I understood: <strong>Funeral Mass</strong><br>Thu Sep 10, 2026 · 10:00 a.m.<br>Calendar: public chapel services<br>Visibility: public<br><br>No priest conflict found. Confirm before saving?", "incoming"), 250);
  } else if (action === "assistant-changes") {
    addTelegramMessage("Show recent calendar changes");
    setTimeout(() => addTelegramMessage("<strong>Recent changes</strong><br>Funeral Mass added · Sep 10<br>Friday Mass moved to 7:00 p.m. · Sep 11<br>All affected leaders notified.", "incoming"), 250);
  } else if (action === "assistant-conflicts") {
    addTelegramMessage("Check public service conflicts");
    setTimeout(() => addTelegramMessage("No unresolved public-service conflicts.<br><br>Private appointments are checked securely and appear here only as <strong>Father unavailable</strong>.", "incoming"), 250);
  }
}

$("#telegram-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#telegram-input");
  if (!input.value.trim()) return;
  addTelegramMessage(input.value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
  input.value = "";
  setTimeout(() => addTelegramMessage("I can help with openings, your schedule, confirmations, absences, and substitute requests. Please choose an option above or include an exact date.", "incoming"), 250);
});
$("#save-proposal").addEventListener("click", event => {
  state.proposalSaved = true; saveState(); event.target.textContent = "Saved to private calendar"; event.target.disabled = true;
  toast("Saved privately. Other schedulers see only ‘Father unavailable.’");
});

applyRole(); renderState(); route();
