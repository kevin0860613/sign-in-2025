// ========== 時間工具（台北時區） ==========
const tzNowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
let now = new Date(tzNowStr);

function refreshNow() {
  const t = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
  now = new Date(t);
}

// "YYYY-MM-DD" + "HH:mm" -> Date（固定 +08:00）
function timeToDate(dateStr, timeStr) {
  const [h, m] = String(timeStr).split(":");
  return new Date(`${dateStr}T${h.padStart(2,"0")}:${m.padStart(2,"0")}:00+08:00`);
}

// 判斷是不是今天（台北時區）
function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

// ========== 豁免名單判斷（讀取 students.js 的 EXEMPT_EMAILS；大小寫不敏感） ==========
function isEmailExempt(emailRaw) {
  if (typeof EXEMPT_EMAILS === "undefined") return false;
  const email = String(emailRaw).trim().toLowerCase();
  return EXEMPT_EMAILS.has(email);
}

// ========== 後端送單（避免 CORS preflight：不自設 Content-Type） ==========
function sendCheckin(name, email, courseName, date, status) {
  const payload = { name, email, course: courseName, date, status };
  return fetch("https://script.google.com/macros/s/AKfycbzMyVqQNkIM9J30FWE3Vjy8pvHZWp93u9IsnawmXc62cOV6ZilwtFosyuNooPsPTLgckw/exec", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(r => r.text())
  .then(t => { console.log("GAS 回應：", t); return t; });

    // 先嘗試 sendBeacon（跨域免CORS）
  if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) {
    console.log("✅ sendBeacon 已送出");
    return Promise.resolve(true);
  }
  // 退回 fetch + no-cors（回應不可讀，但會送到）
  return fetch(url, { method: "POST", mode: "no-cors", body: blob })
    .then(() => { console.log("✅ fetch(no-cors) 已送出"); return true; });
}

// ========== 建立課程選單（value 用唯一鍵：date||time||name；一定先畫 placeholder） ==========
function makeCourseKey(c) { return `${c.date}||${c.time}||${c.name}`; }

function mountCourseOptions() {
  const select = document.getElementById("courseSelect");
  if (!select) return;

  // 先畫出外殼（就算 COURSES 還沒載到也看得到）
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— 請選擇課程 —";
  ph.disabled = true;
  ph.selected = true;
  select.appendChild(ph);

  if (typeof COURSES === "undefined" || !Array.isArray(COURSES)) return;

  for (const c of COURSES) {
    const opt = document.createElement("option");
    opt.value = makeCourseKey(c);
    opt.textContent = `${c.date}｜${c.name}（${c.time}）`;
    select.appendChild(opt);
  }
}

// DOM Ready → 建選單（index.html 請確保先載 students.js、courses.js，再載本檔，且皆加 defer）
document.addEventListener("DOMContentLoaded", mountCourseOptions);

// ========== 表單送出（豁免最優先，直切通過；其餘維持你的規則） ==========
document.getElementById("checkinForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  refreshNow();

  const result = document.getElementById("result");
  result.textContent = "";

  const emailRaw = (document.getElementById("email").value || "").trim();
  const emailLC  = emailRaw.toLowerCase();
  if (!emailRaw) { result.textContent = "請輸入 Email"; return; }

  const selectedVal = document.getElementById("courseSelect").value;
  if (!selectedVal) { result.textContent = "請選擇課程"; return; }

  // 用唯一鍵回找課
  const [selDate, selTime, selName] = selectedVal.split("||");
  const course = (typeof COURSES !== "undefined")
    ? COURSES.find(c => c.date === selDate && c.time === selTime && c.name === selName)
    : null;

  if (!course) { result.textContent = "課程資料錯誤，請重整頁面"; return; }

  // 1) 豁免帳號：最優先＆無條件通過（不看名單/日期/時間）
  if (isEmailExempt(emailRaw)) {
    const nameEx = (typeof STUDENTS !== "undefined" ? (STUDENTS[emailRaw] || STUDENTS[emailLC]) : "") || "（豁免帳號）";
    try {
      await sendCheckin(nameEx, emailRaw, course.name, course.date, "準時");
      result.textContent = "打卡成功！（豁免帳號）";
    } catch {
      result.textContent = "打卡失敗：無法連線後端";
    }
    return;
  }

  // 2) 非豁免 → 檢查是否在名單中（大小寫相容）
  const name = (typeof STUDENTS !== "undefined" ? (STUDENTS[emailRaw] || STUDENTS[emailLC]) : null);
  if (!name) { result.textContent = "打卡失敗：Email 不在名單中"; return; }

  // 3) 檢查是不是今天這堂課
  if (!isToday(course.date)) { result.textContent = "打卡失敗：此課程不在今日"; return; }

  // 4) 檢查課程時間範圍（提前 1 小時可打；一般課超過 15 分算遲到）
  const [start, end] = String(course.time).split("-");
  const startTime = timeToDate(course.date, start);
  const endTime   = timeToDate(course.date, end);
  const early     = new Date(startTime.getTime() - 60 * 60000);
  const grace     = new Date(startTime.getTime() + 15 * 60000);

  let status = "準時";
  if (!course.exemptLateRule) {
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在可打卡時間內";
      return;
    } else if (now > grace) {
      status = "曠課";
    }
  } else {
    // 免遲到場次仍需在可打卡區間
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在打卡有效時間範圍";
      return;
    }
  }

  // 5) 送出
  try {
    await sendCheckin(name, emailRaw, course.name, course.date, status);
    result.textContent = "打卡成功！歡迎上課～";
  } catch {
    result.textContent = "打卡失敗：無法連線後端";
  }
});
