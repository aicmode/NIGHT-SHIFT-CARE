const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const seedShifts = [
  { id: uid(), date: "2026-05-09", type: "Night", start: "17:00", end: "09:00", memo: "集中治療室サポート / 申し送りを丁寧に確認" },
  { id: uid(), date: "2026-05-10", type: "Off", start: "", end: "", memo: "休息日" },
  { id: uid(), date: "2026-05-12", type: "Day", start: "08:30", end: "17:30", memo: "服薬確認のフォロー" }
];

const seedNotes = [
  { id: uid(), title: "夜勤申し送り", date: "2026-05-09", body: "申し送りは短く整理。優先対応と休憩タイミングをチームで共有。" },
  { id: uid(), title: "人員配置メモ", date: "2026-05-11", body: "新人スタッフのフォロー時間を前半に確保。" },
  { id: uid(), title: "記録確認リマインダー", date: "2026-05-12", body: "記録入力の抜けを退勤前に確認。" }
];

let shifts = store.get("nsc_shifts", seedShifts);
let notes = store.get("nsc_notes", seedNotes);
let wellness = store.get("nsc_wellness", []);
let salaryTotal = 448000;

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const toast = document.querySelector("#toast");
const shiftLabels = {
  Day: "日勤",
  Night: "夜勤",
  Off: "休み"
};
const moodLabels = {
  "Very Tired": "かなり疲れている",
  Tired: "疲れている",
  Okay: "普通",
  Good: "良い",
  Great: "とても良い"
};
const demoTextMap = {
  "ICU support / careful handover": "集中治療室サポート / 申し送りを丁寧に確認",
  "ICUサポート / 申し送りを丁寧に確認": "集中治療室サポート / 申し送りを丁寧に確認",
  "Recovery day": "休息日",
  "Medication round follow-up": "服薬確認のフォロー",
  "Night handover": "夜勤申し送り",
  "Staffing memo": "人員配置メモ",
  "Care log reminder": "記録確認リマインダー"
};

function normalizeDemoText() {
  shifts = shifts.map(shift => ({
    ...shift,
    memo: demoTextMap[shift.memo] || shift.memo
  }));
  notes = notes.map(note => ({
    ...note,
    title: demoTextMap[note.title] || note.title
  }));
  store.set("nsc_shifts", shifts);
  store.set("nsc_notes", notes);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("active", screen.id === screenId));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-screen], [data-screen-link]").forEach(button => {
  button.addEventListener("click", () => switchScreen(button.dataset.screen || button.dataset.screenLink));
});

function renderCalendar() {
  const grid = document.querySelector("#calendarGrid");
  const selectedLabel = document.querySelector("#selectedDateLabel");
  grid.innerHTML = "";

  for (let i = 0; i < 5; i += 1) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    grid.append(empty);
  }

  for (let day = 1; day <= 31; day += 1) {
    const date = `2026-05-${String(day).padStart(2, "0")}`;
    const type = getShiftTypeForDay(day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `day-cell ${day === 9 ? "selected" : ""}`;
    cell.innerHTML = `<span class="day-number">${day}</span><span class="shift-badge shift-${type.toLowerCase()}">${shiftLabels[type]}</span>`;
    cell.addEventListener("click", () => {
      document.querySelectorAll(".day-cell").forEach(item => item.classList.remove("selected"));
      cell.classList.add("selected");
      selectedLabel.textContent = `選択中: 5月${day}日`;
    });
    grid.append(cell);
  }

  renderSummary();
}

function getShiftTypeForDay(day) {
  const date = `2026-05-${String(day).padStart(2, "0")}`;
  const customShift = shifts.find(shift => shift.date === date);
  const shiftPattern = ["Off", "Day", "Day", "Night", "Night", "Off", "Day"];
  return customShift?.type || shiftPattern[day % shiftPattern.length];
}

function renderSummary() {
  const counts = { Day: 0, Night: 0, Off: 0 };

  for (let day = 1; day <= 31; day += 1) {
    counts[getShiftTypeForDay(day)] += 1;
  }

  const hours = counts.Day * 8 + counts.Night * 16;
  document.querySelector("#summaryDay").textContent = counts.Day;
  document.querySelector("#summaryNight").textContent = counts.Night;
  document.querySelector("#summaryOff").textContent = counts.Off;
  document.querySelector("#summaryHours").textContent = hours;
  document.querySelector("#dashHours").textContent = hours;
}

function renderShifts() {
  const list = document.querySelector("#shiftList");
  const count = document.querySelector("#shiftCount");
  list.innerHTML = "";
  count.textContent = `${shifts.length}件`;

  if (shifts.length === 0) {
    list.innerHTML = `<article class="data-item"><strong>まだシフトはありません</strong><p>日付と勤務タイプを選んで、シフトを追加できます。</p></article>`;
    return;
  }

  shifts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(shift => {
      const item = document.createElement("article");
      item.className = "data-item";
      item.innerHTML = `
        <header><strong>${shiftLabels[shift.type]}シフト</strong><span class="shift-badge shift-${shift.type.toLowerCase()}">${shiftLabels[shift.type]}</span></header>
        <small>${shift.date} ${shift.start || "--:--"} - ${shift.end || "--:--"}</small>
        <p>${shift.memo || "メモはありません"}</p>
      `;
      list.append(item);
    });
}

function renderNotes() {
  const list = document.querySelector("#noteList");
  const dashboardNotes = document.querySelector("#dashboardNotes");
  const count = document.querySelector("#noteCount");
  list.innerHTML = "";
  dashboardNotes.innerHTML = "";
  count.textContent = `${notes.length}件`;

  if (notes.length === 0) {
    list.innerHTML = `<article class="data-item"><strong>まだメモはありません</strong><p>勤務中の申し送りや気づきを保存できます。</p></article>`;
    dashboardNotes.innerHTML = `<article class="mini-item"><strong>まだメモはありません</strong><p>勤務メモ画面から追加できます。</p></article>`;
    return;
  }

  notes.slice().reverse().forEach(note => {
    const item = document.createElement("article");
    item.className = "data-item";
    item.innerHTML = `
      <header><strong>${note.title}</strong><button class="delete-button" type="button">削除</button></header>
      <small>${note.date}</small>
      <p>${note.body}</p>
    `;
    item.querySelector("button").addEventListener("click", () => {
      notes = notes.filter(saved => saved.id !== note.id);
      store.set("nsc_notes", notes);
      renderNotes();
      showToast("メモを削除しました。");
    });
    list.append(item);
  });

  notes.slice(-3).reverse().forEach(note => {
    const item = document.createElement("article");
    item.className = "mini-item";
    item.innerHTML = `<strong>${note.title}</strong><p>${note.date} / ${note.body}</p>`;
    dashboardNotes.append(item);
  });
}

function renderWellness() {
  const list = document.querySelector("#wellnessList");
  const count = document.querySelector("#wellnessCount");
  list.innerHTML = "";
  count.textContent = `${wellness.length}件`;

  if (wellness.length === 0) {
    list.innerHTML = `<article class="data-item"><strong>まだ体調記録はありません</strong><p>元気度・睡眠時間・ストレス度を保存できます。</p></article>`;
    return;
  }

  wellness.slice().reverse().forEach(entry => {
    const item = document.createElement("article");
    item.className = "data-item";
    item.innerHTML = `
      <header><strong>${moodLabels[entry.mood] || entry.mood}</strong><small>${entry.date}</small></header>
      <p>元気度 ${entry.energy}% / 睡眠 ${entry.sleep}時間 / ストレス ${entry.stress}%</p>
      <p>${entry.note || "体調メモはありません"}</p>
    `;
    list.append(item);
  });
}

function updateRangeValues() {
  document.querySelector("#rangeValues").textContent =
    `元気度 ${energyLevel.value}% / 睡眠 ${sleepHours.value}時間 / ストレス ${stressLevel.value}%`;
}

function animateNumber(element, to) {
  const from = Number(element.dataset.value || 0);
  const duration = 850;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + (to - from) * eased);
    element.textContent = yen.format(value);
    element.dataset.value = value;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

document.querySelector("#shiftForm").addEventListener("submit", event => {
  event.preventDefault();
  shifts.push({
    id: uid(),
    date: shiftDate.value,
    type: shiftType.value,
    start: shiftStart.value,
    end: shiftEnd.value,
    memo: shiftMemo.value.trim()
  });
  store.set("nsc_shifts", shifts);
  event.target.reset();
  shiftStart.value = "09:00";
  shiftEnd.value = "18:00";
  renderShifts();
  renderCalendar();
  showToast("シフトを追加しました。");
});

document.querySelector("#noteForm").addEventListener("submit", event => {
  event.preventDefault();
  notes.push({
    id: uid(),
    title: noteTitle.value.trim(),
    date: noteDate.value,
    body: noteBody.value.trim()
  });
  store.set("nsc_notes", notes);
  event.target.reset();
  renderNotes();
  showToast("メモを保存しました。");
});

document.querySelector("#wellnessForm").addEventListener("submit", event => {
  event.preventDefault();
  wellness.push({
    id: uid(),
    date: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
    mood: wellMood.value,
    energy: energyLevel.value,
    sleep: sleepHours.value,
    stress: stressLevel.value,
    note: conditionNote.value.trim()
  });
  store.set("nsc_wellness", wellness);
  conditionNote.value = "";
  renderWellness();
  showToast("体調記録を保存しました。");
});

document.querySelector("#salaryForm").addEventListener("submit", event => {
  event.preventDefault();
  const total =
    Number(dayCount.value) * Number(dayRate.value) +
    Number(nightCount.value) * Number(nightRate.value) +
    Number(nightCount.value) * Number(nightBonus.value);
  salaryTotal = total;
  animateNumber(document.querySelector("#earningsResult"), total);
  animateNumber(document.querySelector("#dashboardSalary"), total);
  document.querySelector("#dashBonus").textContent = yen.format(Number(nightCount.value) * Number(nightBonus.value));
  showToast("給与見積もりを更新しました。");
});

document.querySelectorAll("#dashboardMood button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#dashboardMood button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector("#moodLabel").textContent = button.textContent;
  });
});

[energyLevel, sleepHours, stressLevel].forEach(input => input.addEventListener("input", updateRangeValues));

function initDates() {
  const today = "2026-05-09";
  shiftDate.value = today;
  noteDate.value = today;
}

function init() {
  normalizeDemoText();
  initDates();
  renderCalendar();
  renderShifts();
  renderNotes();
  renderWellness();
  updateRangeValues();
  document.querySelector("#earningsResult").dataset.value = salaryTotal;
  document.querySelector("#dashboardSalary").dataset.value = salaryTotal;
}

init();
