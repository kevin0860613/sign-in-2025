// ========== 工具：時間與日期（台北時區） ==========
const tzNowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
let now = new Date(tzNowStr);

function refreshNow() {
  const t = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
  now = new Date(t);
}

// "YYYY-MM-DD" + "HH:mm" -> Date（固定 +08:00）
function timeToDate(dateStr, timeStr) {
  const [h, m] = timeStr.split(":");
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+08:00`);
}

function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

// ========== 工具：豁免名單判斷（讀取 students.js 的 EXEMPT_EMAILS） ==========
function isEmailExempt(emailRaw) {
  if (typeof EXEMPT_EMAILS === "undefined") return false;
  const email = String(emailRaw).trim().toLowerCase();
  return EXEMPT_EMAILS.has(email);
}

// ========== 後端送單（避免 CORS preflight） ==========
function sendCheckin(name, email, courseName, date, status) {
  const payload = { name, email, course: courseName, date, status };

  return fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    body: JSON.stringify(payload) // 不設 Content-Type，避免 preflight
  })
  .then(r => r.text())
  .then(t => { console.log("GAS 回應：", t); return t; })
  .catch(err => { console.error("Fetch 錯誤：", err); throw err; });
}

// ========== 建立課程選單 ==========
function makeCourseKey(c) {
  return `${c.date}||${c.time}||${c.name}`;
}

function mountCourseOptions() {
  const select = document.getElementById("courseSelect");
  if (!select || typeof COURSES === "undefined") return;

  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— 請選擇課程 —";
  ph.disabled = true;
  ph.selected = true;
  select.appendChild(ph);

  COURSES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = makeCourseKey(c);
    opt.textContent = `${c.date}｜${c.name}（${c.time}）`;
    select.appendChild(opt);
  });
}

// ========== 表單行為 ==========
document.getElementById("checkinForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  refreshNow();

  const result = document.getElementById("result");
  result.textContent = "";

  const emailRaw = (document.getElementById("email").value || "").trim();
  if (!emailRaw) {
    result.textContent = "請輸入 Email";
    return;
  }

  const selectedVal = document.getElementById("courseSelect").value;
  if (!selectedVal) {
    result.textContent = "請選擇課程";
    return;
  }

  const [selDate, selTime, selName] = selectedVal.split("||");
  const course = (typeof COURSES !== "undefined") ?
    COURSES.find(c => c.date === selDate && c.time === selTime && c.name === selName) : null;

  if (!course) {
    result.textContent = "課程資料錯誤，請重整頁面";
    return;
  }

  // 1) 豁免帳號
  if (isEmailExempt(emailRaw)) {
    const nameEx = (typeof STUDENTS !== "undefined" ? STUDENTS[emailRaw] : "") || "（豁免帳號）";
    try {
      await sendCheckin(nameEx, emailRaw, course.name, course.date, "準時");
      result.textContent = "打卡成功！（豁免帳號）";
    } catch {
      result.textContent = "打卡失敗：無法連線後端";
    }
    return;
  }

  // 2) 非豁免 → 檢查名單
  if (typeof STUDENTS === "undefined" || !STUDENTS[emailRaw]) {
    result.textContent = "打卡失敗：Email 不在名單中";
    return;
  }
  const name = STUDENTS[emailRaw];

  // 3) 日期檢查
  if (!isToday(course.date)) {
    result.textContent = "打卡失敗：此課程不在今日";
    return;
  }

  // 4) 時間檢查
  const [start, end] = String(course.time).split("-");
  const startTime = timeToDate(course.date, start);
  const endTime = timeToDate(course.date, end);
  const early = new Date(startTime.getTime() - 60 * 60000);
  const grace = new Date(startTime.getTime() + 10 * 60000);

  let status = "準時";
  if (!course.exemptLateRule) {
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在可打卡時間內";
      return;
    } else if (now > grace) {
      status = "遲到";
    }
  } else {
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在打卡有效時間範圍";
      return;
    }
  }

  // 5) 正式送出
  try {
    await sendCheckin(name, emailRaw, course.name, course.date, status);
    result.textContent = "打卡成功！歡迎上課～";
  } catch {
    result.textContent = "打卡失敗：無法連線後端";
  }
});

// DOM Ready → 建選單
document.addEventListener("DOMContentLoaded", mountCourseOptions);
