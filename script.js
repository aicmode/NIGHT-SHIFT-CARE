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

const $ = selector => document.querySelector(selector);

function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const shiftTypes = [
  { value: "Day", label: "日勤", className: "day", start: "08:30", end: "17:30", breakMinutes: 60, group: "day" },
  { value: "Night", label: "夜勤", className: "night", start: "19:00", end: "07:00", breakMinutes: 120, group: "night" },
  { value: "Off", label: "休み", className: "off", start: "00:00", end: "00:00", breakMinutes: 0, group: "off" },
  { value: "Early", label: "早番", className: "early", start: "07:00", end: "16:00", breakMinutes: 60, group: "early" },
  { value: "Late", label: "遅番", className: "late", start: "11:00", end: "20:00", breakMinutes: 60, group: "late" },
  { value: "SemiNight", label: "準夜勤", className: "seminight", start: "16:00", end: "00:30", breakMinutes: 60, group: "night" },
  { value: "Graveyard", label: "深夜勤", className: "graveyard", start: "00:00", end: "09:00", breakMinutes: 60, group: "night" },
  { value: "AfterNight", label: "明け", className: "after-night", start: "00:00", end: "00:00", breakMinutes: 0, group: "off" },
  { value: "PaidLeave", label: "有給", className: "paid-leave", start: "00:00", end: "00:00", breakMinutes: 0, group: "off" },
  { value: "RequestOff", label: "希望休", className: "request-off", start: "00:00", end: "00:00", breakMinutes: 0, group: "off" },
  { value: "Training", label: "研修", className: "training", start: "09:00", end: "17:00", breakMinutes: 60, group: "day" },
  { value: "Meeting", label: "会議", className: "meeting", start: "13:00", end: "15:00", breakMinutes: 0, group: "day" },
  { value: "Other", label: "その他", className: "other", start: "09:00", end: "18:00", breakMinutes: 60, group: "day" }
];

const shiftMap = Object.fromEntries(shiftTypes.map(type => [type.value, type]));
const shiftLabels = Object.fromEntries(shiftTypes.map(type => [type.value, type.label]));
const restTypes = new Set(["Off", "AfterNight", "PaidLeave", "RequestOff"]);
const nightTypes = new Set(["Night", "SemiNight", "Graveyard"]);
const breakOptions = [0, 30, 45, 60, 90, 120, 150, 180];
const demoToday = "2026-05-09";

const seedShifts = [
  { id: uid(), date: "2026-05-09", type: "Night", start: "19:00", end: "07:00", breakMinutes: 120, memo: "集中治療室サポート / 申し送りを丁寧に確認" },
  { id: uid(), date: "2026-05-10", type: "Day", start: "08:30", end: "17:30", breakMinutes: 60, memo: "服薬確認のフォロー" },
  { id: uid(), date: "2026-05-12", type: "Early", start: "07:00", end: "16:00", breakMinutes: 60, memo: "朝の受け入れ準備" }
];

const seedNotes = [
  { id: uid(), title: "夜勤申し送り", date: "2026-05-09", body: "申し送りは短く整理。優先対応と休憩タイミングをチームで共有。" },
  { id: uid(), title: "人員配置メモ", date: "2026-05-11", body: "新人スタッフのフォロー時間を前半に確保。" },
  { id: uid(), title: "記録確認リマインダー", date: "2026-05-12", body: "記録入力の抜けを退勤前に確認。" }
];

const defaultSalaryInputs = {
  dayCount: 14,
  nightCount: 5,
  earlyCount: 2,
  lateCount: 2,
  paidLeaveCount: 0,
  dayRate: 12000,
  nightRate: 18000,
  earlyRate: 11000,
  lateRate: 13000,
  nightBonus: 8000,
  hourlyWage: 0,
  transportation: 10000,
  otherAllowance: 5000,
  deduction: 0
};

let shifts = store.get("nsc_shifts", seedShifts);
let notes = store.get("nsc_notes", seedNotes);
let wellness = store.get("nsc_wellness", []);
let salaryInputs = { ...defaultSalaryInputs, ...store.get("nsc_salary", {}) };
let salaryTotal = calculateSalary(salaryInputs).total;
let calendarYear = 2026;
let calendarMonth = 5;
let selectedDate = demoToday;

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const toast = $("#toast");
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getDateParts(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return { year, month, day };
}

function formatMonthDay(dateValue) {
  const { month, day } = getDateParts(dateValue);
  return `${month}月${day}日`;
}

function formatFullDate(dateValue) {
  const { year, month, day } = getDateParts(dateValue);
  return `${year}年${month}月${day}日`;
}

function getShiftMeta(type) {
  return shiftMap[type] || shiftMap.Other;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateShiftMinutes(shift) {
  if (restTypes.has(shift.type)) return 0;
  if (!shift.start || !shift.end) return 0;
  let end = timeToMinutes(shift.end);
  const start = timeToMinutes(shift.start);
  if (end <= start) end += 24 * 60;
  return Math.max(0, end - start - Number(shift.breakMinutes || 0));
}

function formatMinutes(minutes) {
  if (!minutes) return "0時間";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}時間` : `${hours.toFixed(1)}時間`;
}

function normalizeDemoText() {
  shifts = shifts.map(shift => {
    const meta = getShiftMeta(shift.type);
    return {
      ...shift,
      type: shiftMap[shift.type] ? shift.type : "Other",
      start: shift.start ?? meta.start,
      end: shift.end ?? meta.end,
      breakMinutes: Number(shift.breakMinutes ?? meta.breakMinutes),
      memo: demoTextMap[shift.memo] || shift.memo || ""
    };
  });
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

function populateSelects() {
  const typeOptions = shiftTypes.map(type => `<option value="${type.value}">${type.label}</option>`).join("");
  $("#shiftType").innerHTML = typeOptions;
  $("#calendarShiftType").innerHTML = typeOptions;

  const times = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  const timeOptions = times.map(time => `<option value="${time}">${time}</option>`).join("");
  $("#shiftStart").innerHTML = timeOptions;
  $("#shiftEnd").innerHTML = timeOptions;

  $("#shiftBreak").innerHTML = breakOptions.map(minutes => `<option value="${minutes}">${minutes}分</option>`).join("");
  $("#calendarYear").innerHTML = Array.from({ length: 7 }, (_, index) => 2024 + index)
    .map(year => `<option value="${year}">${year}年</option>`)
    .join("");
  $("#calendarMonth").innerHTML = Array.from({ length: 12 }, (_, index) => index + 1)
    .map(month => `<option value="${month}">${month}月</option>`)
    .join("");
}

function syncCalendarControls() {
  $("#calendarYear").value = calendarYear;
  $("#calendarMonth").value = calendarMonth;
  $("#dashboardPeriod").textContent = `${calendarYear}年${calendarMonth}月`;
}

function getShiftsForDate(dateValue) {
  return shifts
    .filter(shift => shift.date === dateValue)
    .sort((a, b) => `${a.start || "99:99"}-${a.id}`.localeCompare(`${b.start || "99:99"}-${b.id}`));
}

function renderCalendar() {
  const grid = $("#calendarGrid");
  grid.innerHTML = "";
  syncCalendarControls();

  const firstDay = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

  for (let i = 0; i < firstDay; i += 1) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    grid.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = dateKey(calendarYear, calendarMonth, day);
    const dayShifts = getShiftsForDate(currentDate);
    const primaryShift = dayShifts[0];
    const meta = primaryShift ? getShiftMeta(primaryShift.type) : null;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `day-cell ${currentDate === selectedDate ? "selected" : ""}`;
    cell.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="shift-badge shift-${meta ? meta.className : "unregistered"}">${meta ? meta.label : "未登録"}</span>
      ${dayShifts.length > 1 ? `<span class="day-more">+${dayShifts.length - 1}件</span>` : ""}
    `;
    cell.addEventListener("click", () => selectCalendarDate(currentDate));
    grid.append(cell);
  }

  renderSelectedDate();
  renderSummary();
  renderShiftSnapshot();
}

function selectCalendarDate(dateValue) {
  selectedDate = dateValue;
  const { year, month } = getDateParts(dateValue);
  calendarYear = year;
  calendarMonth = month;
  $("#shiftDate").value = dateValue;
  renderCalendar();
  updateShiftDateHint();
}

function renderSelectedDate() {
  $("#selectedDateLabel").textContent = `選択中：${formatMonthDay(selectedDate)}`;
  $("#calendarEditorDate").textContent = formatFullDate(selectedDate);
  const firstShift = getShiftsForDate(selectedDate)[0];
  $("#calendarShiftType").value = firstShift?.type || "Day";
}

function getMonthShifts() {
  const prefix = `${calendarYear}-${pad(calendarMonth)}-`;
  return shifts.filter(shift => shift.date.startsWith(prefix));
}

function renderSummary() {
  const counts = { day: 0, night: 0, off: 0, early: 0, late: 0 };
  const monthShifts = getMonthShifts();
  let totalMinutes = 0;

  monthShifts.forEach(shift => {
    const meta = getShiftMeta(shift.type);
    if (meta.group === "day") counts.day += 1;
    if (meta.group === "night") counts.night += 1;
    if (meta.group === "off") counts.off += 1;
    if (meta.group === "early") counts.early += 1;
    if (meta.group === "late") counts.late += 1;
    totalMinutes += calculateShiftMinutes(shift);
  });

  $("#summaryDay").textContent = counts.day;
  $("#summaryNight").textContent = counts.night;
  $("#summaryOff").textContent = counts.off;
  $("#summaryEarly").textContent = counts.early;
  $("#summaryLate").textContent = counts.late;
  $("#summaryHours").textContent = formatMinutes(totalMinutes);
  $("#dashHours").textContent = formatMinutes(totalMinutes);
  $("#dashBonus").textContent = yen.format(counts.night * Number(salaryInputs.nightBonus || 0));
}

function getWorkingShifts() {
  return shifts
    .filter(shift => !restTypes.has(shift.type))
    .slice()
    .sort((a, b) => `${a.date} ${a.start || "00:00"}`.localeCompare(`${b.date} ${b.start || "00:00"}`));
}

function renderShiftSnapshot() {
  const todayShift = getShiftsForDate(demoToday).find(shift => !restTypes.has(shift.type));
  const workingShifts = getWorkingShifts();
  const nextShift = workingShifts.find(shift => shift.date > demoToday);

  if (todayShift) {
    const meta = getShiftMeta(todayShift.type);
    $("#todayShiftType").textContent = todayShift.type === "Night" ? "Night Shift" : meta.label;
    $("#todayShiftTime").textContent = `${todayShift.start || "--:--"} - ${todayShift.end || "--:--"}`;
    $("#todayBreak").textContent = `休憩 ${todayShift.breakMinutes || 0}分`;
  } else {
    $("#todayShiftType").textContent = "未登録";
    $("#todayShiftTime").textContent = "--:-- - --:--";
    $("#todayBreak").textContent = "休憩 0分";
  }

  if (nextShift) {
    $("#nextShiftDate").textContent = formatMonthDay(nextShift.date);
    $("#nextShiftType").textContent = getShiftMeta(nextShift.type).label;
    $("#nextShiftTime").textContent = `${nextShift.start || "--:--"} - ${nextShift.end || "--:--"}`;
    $("#todayNextGap").textContent = "次の勤務まで 8時間";
  }
}

function renderShifts() {
  const list = $("#shiftList");
  const count = $("#shiftCount");
  list.innerHTML = "";
  count.textContent = `${shifts.length}件`;

  if (shifts.length === 0) {
    list.innerHTML = `<article class="data-item empty-state"><strong>まだシフトは登録されていません。</strong><p>下のフォームから勤務予定を追加できます。</p></article>`;
    return;
  }

  shifts
    .slice()
    .sort((a, b) => `${a.date} ${a.start || "99:99"}`.localeCompare(`${b.date} ${b.start || "99:99"}`))
    .forEach(shift => {
      const meta = getShiftMeta(shift.type);
      const item = document.createElement("article");
      item.className = "data-item";
      item.innerHTML = `
        <header><strong>${meta.label}シフト</strong><span class="shift-badge shift-${meta.className}">${meta.label}</span></header>
        <small>${shift.date} ${shift.start || "--:--"} - ${shift.end || "--:--"} / 休憩 ${shift.breakMinutes || 0}分</small>
        <p>勤務時間 ${formatMinutes(calculateShiftMinutes(shift))}</p>
        <p>${shift.memo || "メモはありません"}</p>
      `;
      list.append(item);
    });
}

function renderNotes() {
  const list = $("#noteList");
  const dashboardNotes = $("#dashboardNotes");
  const count = $("#noteCount");
  list.innerHTML = "";
  dashboardNotes.innerHTML = "";
  count.textContent = `${notes.length}件`;

  if (notes.length === 0) {
    list.innerHTML = `<article class="data-item empty-state"><strong>まだ勤務メモはありません。</strong><p>申し送りや気づいたことを記録できます。</p></article>`;
    dashboardNotes.innerHTML = `<article class="mini-item empty-state"><strong>まだ勤務メモはありません。</strong><p>勤務メモ画面から追加できます。</p></article>`;
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
  const list = $("#wellnessList");
  const count = $("#wellnessCount");
  list.innerHTML = "";
  count.textContent = `${wellness.length}件`;

  if (wellness.length === 0) {
    list.innerHTML = `<article class="data-item empty-state"><strong>まだ体調記録はありません。</strong><p>勤務前後のコンディションを残せます。</p></article>`;
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
  $("#rangeValues").textContent =
    `元気度 ${$("#energyLevel").value}% / 睡眠 ${$("#sleepHours").value}時間 / ストレス ${$("#stressLevel").value}%`;
}

function getSalaryInputsFromForm() {
  return Object.fromEntries(
    Object.keys(defaultSalaryInputs).map(key => [key, Number($(`#${key}`).value || 0)])
  );
}

function calculateSalary(values) {
  const dayPay = values.dayCount * values.dayRate;
  const nightPay = values.nightCount * values.nightRate;
  const nightBonusPay = values.nightCount * values.nightBonus;
  const earlyPay = values.earlyCount * values.earlyRate;
  const latePay = values.lateCount * values.lateRate;
  const paidLeavePay = values.paidLeaveCount * values.dayRate;
  const total =
    dayPay +
    nightPay +
    nightBonusPay +
    earlyPay +
    latePay +
    paidLeavePay +
    values.transportation +
    values.otherAllowance -
    values.deduction;

  return {
    dayPay,
    nightPay,
    nightBonusPay,
    earlyPay,
    latePay,
    paidLeavePay,
    transportation: values.transportation,
    otherAllowance: values.otherAllowance,
    deduction: values.deduction,
    total
  };
}

function renderSalaryBreakdown(parts) {
  $("#salaryBreakdown").innerHTML = `
    <div><span>日勤分</span><strong>${yen.format(parts.dayPay)}</strong></div>
    <div><span>夜勤分</span><strong>${yen.format(parts.nightPay)}</strong></div>
    <div><span>夜勤手当</span><strong>${yen.format(parts.nightBonusPay)}</strong></div>
    <div><span>早番分</span><strong>${yen.format(parts.earlyPay)}</strong></div>
    <div><span>遅番分</span><strong>${yen.format(parts.latePay)}</strong></div>
    <div><span>有給分</span><strong>${yen.format(parts.paidLeavePay)}</strong></div>
    <div><span>交通費</span><strong>${yen.format(parts.transportation)}</strong></div>
    <div><span>その他手当</span><strong>${yen.format(parts.otherAllowance)}</strong></div>
    <div><span>控除</span><strong>-${yen.format(parts.deduction)}</strong></div>
  `;
}

function animateNumber(element, to) {
  const from = Number(element.dataset.value || 0);
  const duration = 850;
  const start = performance.now();
  element.dataset.value = to;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + (to - from) * eased);
    element.textContent = yen.format(value);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function updateSalary({ animate = false } = {}) {
  const parts = calculateSalary(salaryInputs);
  salaryTotal = parts.total;
  renderSalaryBreakdown(parts);
  const earnings = $("#earningsResult");
  const dashboardSalary = $("#dashboardSalary");
  if (animate) {
    animateNumber(earnings, parts.total);
    animateNumber(dashboardSalary, parts.total);
  } else {
    earnings.textContent = yen.format(parts.total);
    dashboardSalary.textContent = yen.format(parts.total);
    earnings.dataset.value = parts.total;
    dashboardSalary.dataset.value = parts.total;
  }
  renderSummary();
}

function updateShiftDurationPreview() {
  const shift = {
    type: $("#shiftType").value,
    start: $("#shiftStart").value,
    end: $("#shiftEnd").value,
    breakMinutes: Number($("#shiftBreak").value || 0)
  };
  $("#shiftDurationPreview").textContent = formatMinutes(calculateShiftMinutes(shift));
}

function updateShiftDateHint() {
  const dateValue = $("#shiftDate").value;
  const count = getShiftsForDate(dateValue).length;
  $("#shiftDateHint").textContent = count
    ? `${formatFullDate(dateValue)} は登録済みです。追加すると同じ日の予定としてリストに並びます。`
    : "同じ日付に複数の勤務予定を登録できます。";
}

function applyShiftDefaults(typeValue) {
  const meta = getShiftMeta(typeValue);
  $("#shiftStart").value = meta.start;
  $("#shiftEnd").value = meta.end;
  $("#shiftBreak").value = String(meta.breakMinutes);
  updateShiftDurationPreview();
}

function moveMonth(offset) {
  const next = new Date(calendarYear, calendarMonth - 1 + offset, 1);
  const nextYear = Math.min(2030, Math.max(2024, next.getFullYear()));
  calendarYear = nextYear;
  calendarMonth = nextYear === next.getFullYear() ? next.getMonth() + 1 : calendarMonth;
  const day = Math.min(getDateParts(selectedDate).day, new Date(calendarYear, calendarMonth, 0).getDate());
  selectedDate = dateKey(calendarYear, calendarMonth, day);
  $("#shiftDate").value = selectedDate;
  renderCalendar();
}

function saveCalendarShift() {
  const type = $("#calendarShiftType").value;
  const meta = getShiftMeta(type);
  const existing = shifts.find(shift => shift.date === selectedDate && shift.source === "calendar");
  const payload = {
    id: existing?.id || uid(),
    date: selectedDate,
    type,
    start: meta.start,
    end: meta.end,
    breakMinutes: meta.breakMinutes,
    memo: "カレンダーから登録",
    source: "calendar"
  };

  if (existing) {
    shifts = shifts.map(shift => (shift.id === existing.id ? payload : shift));
    showToast("選択日のシフトを更新しました。");
  } else {
    shifts.push(payload);
    showToast("選択日にシフトを登録しました。");
  }

  store.set("nsc_shifts", shifts);
  renderCalendar();
  renderShifts();
  updateShiftDateHint();
}

function initDates() {
  $("#shiftDate").value = selectedDate;
  $("#noteDate").value = selectedDate;
  updateShiftDateHint();
}

function initSalaryForm() {
  Object.entries(salaryInputs).forEach(([key, value]) => {
    const input = $(`#${key}`);
    if (input) input.value = value;
  });
  updateSalary();
}

function bindEvents() {
  document.querySelectorAll("[data-screen], [data-screen-link]").forEach(button => {
    button.addEventListener("click", () => switchScreen(button.dataset.screen || button.dataset.screenLink));
  });

  $("#prevMonth").addEventListener("click", () => moveMonth(-1));
  $("#nextMonth").addEventListener("click", () => moveMonth(1));
  $("#calendarYear").addEventListener("change", event => {
    calendarYear = Number(event.target.value);
    selectedDate = dateKey(calendarYear, calendarMonth, Math.min(getDateParts(selectedDate).day, new Date(calendarYear, calendarMonth, 0).getDate()));
    $("#shiftDate").value = selectedDate;
    renderCalendar();
  });
  $("#calendarMonth").addEventListener("change", event => {
    calendarMonth = Number(event.target.value);
    selectedDate = dateKey(calendarYear, calendarMonth, Math.min(getDateParts(selectedDate).day, new Date(calendarYear, calendarMonth, 0).getDate()));
    $("#shiftDate").value = selectedDate;
    renderCalendar();
  });
  $("#saveCalendarShift").addEventListener("click", saveCalendarShift);

  $("#shiftType").addEventListener("change", event => applyShiftDefaults(event.target.value));
  ["#shiftStart", "#shiftEnd", "#shiftBreak"].forEach(selector => {
    $(selector).addEventListener("change", updateShiftDurationPreview);
  });
  $("#shiftDate").addEventListener("change", event => {
    const { year, month } = getDateParts(event.target.value);
    calendarYear = year;
    calendarMonth = month;
    selectedDate = event.target.value;
    renderCalendar();
    updateShiftDateHint();
  });

  $("#shiftForm").addEventListener("submit", event => {
    event.preventDefault();
    shifts.push({
      id: uid(),
      date: $("#shiftDate").value,
      type: $("#shiftType").value,
      start: $("#shiftStart").value,
      end: $("#shiftEnd").value,
      breakMinutes: Number($("#shiftBreak").value || 0),
      memo: $("#shiftMemo").value.trim()
    });
    store.set("nsc_shifts", shifts);
    $("#shiftMemo").value = "";
    renderShifts();
    renderCalendar();
    updateShiftDateHint();
    showToast("シフトを追加しました。");
  });

  $("#noteForm").addEventListener("submit", event => {
    event.preventDefault();
    notes.push({
      id: uid(),
      title: $("#noteTitle").value.trim(),
      date: $("#noteDate").value,
      body: $("#noteBody").value.trim()
    });
    store.set("nsc_notes", notes);
    event.target.reset();
    $("#noteDate").value = selectedDate;
    renderNotes();
    showToast("メモを保存しました。");
  });

  $("#wellnessForm").addEventListener("submit", event => {
    event.preventDefault();
    wellness.push({
      id: uid(),
      date: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
      mood: $("#wellMood").value,
      energy: $("#energyLevel").value,
      sleep: $("#sleepHours").value,
      stress: $("#stressLevel").value,
      note: $("#conditionNote").value.trim()
    });
    store.set("nsc_wellness", wellness);
    $("#conditionNote").value = "";
    renderWellness();
    showToast("体調記録を保存しました。");
  });

  $("#salaryForm").addEventListener("submit", event => {
    event.preventDefault();
    salaryInputs = getSalaryInputsFromForm();
    store.set("nsc_salary", salaryInputs);
    updateSalary({ animate: true });
    showToast("給与見積もりを更新しました。");
  });

  document.querySelectorAll("#dashboardMood button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#dashboardMood button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      $("#moodLabel").textContent = button.textContent;
    });
  });

  ["#energyLevel", "#sleepHours", "#stressLevel"].forEach(selector => {
    $(selector).addEventListener("input", updateRangeValues);
  });
}

function init() {
  normalizeDemoText();
  populateSelects();
  bindEvents();
  initDates();
  applyShiftDefaults("Day");
  initSalaryForm();
  renderCalendar();
  renderShifts();
  renderNotes();
  renderWellness();
  updateRangeValues();
}

init();
