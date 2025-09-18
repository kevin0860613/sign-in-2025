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
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+08:00`);
}

// 判斷是不是今天（台北時區）
function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

// ========== 豁免名單判斷（Array/Set 皆可；大小寫不敏感） ==========
function isEmailExempt(emailRaw) {
  if (typeof EXEMPT_EMAILS === "undefined") return false;
  const email = String(emailRaw).trim().toLowerCase();
  if (EXEMPT_EMAILS instanceof Set) return EXEMPT_EMAILS.has(email);
  if (Array.isArray(EXEMPT_EMAILS)) {
    return EXEMPT_EMAILS.some(s => String(s).trim().toLowerCase() === email);
  }
  return false;
}

// ========== 後端送單（避免 CORS preflight：不自設 Content-Type） ==========
function sendCheckin(name, email, courseName, date, status) {
  const payload = { name, email, course: courseName, date, status };

  return fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    body: JSON.stringify(payload) // 不手動設 headers，避免 preflight
  })
  .then(r => r.text())
  .then(t => {
    console.log("GAS 回應：", t);
    return t;
  })
  .catch(err => {
    console.error("Fetch 錯誤：", err);
    throw err;
  });
}

// ========== 建立課程選單（先畫 placeholder；COURSES 載到再塞） ==========
function mountCourseOptions() {
  const select = document.getElementById("courseSelect");
  if (!select) return;

  // 清空並先放 placeholder（就算 COURSES 還沒載也看得到下拉）
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— 請選擇課程 —";
  ph.disabled = true;
  ph.selected = true;
  select.appendChild(ph);

  // COURSES 尚未載入 → 保留 placeholder，不讓整個下拉消失
  if (typeof COURSES === "undefined" || !Array.isArray(COURSES)) {
    console.warn("COURSES 尚未載入或格式錯誤，僅顯示 placeholder。");
    return;
  }

  // 沿用你的做法：option.value = 課名（注意：重名會命中第一筆，這是原設計）
  for (const c of COURSES) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.date}｜${c.name}（${c.time}）`;
    select.appendChild(opt);
  }
}

// DOM Ready 一定執行（配合 index.html 的 defer，這裡穩）
document.addEventListener("DOMContentLoaded", mountCourseOptions);

// ========== 表單送出（維持你原本邏輯，僅小幅穩定化） ==========
document.getElementById("checkinForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  refreshNow();

  const result = document.getElementById("result");
  result.textContent = "";

  const emailRaw = (document.getElementById("email").value || "").trim();
  if (!emailRaw) { result.textContent = "請輸入 Email"; return; }

  const selectedCourseName = document.getElementById("courseSelect").value;
  if (!selectedCourseName) { result.textContent = "請選擇課程"; return; }

  // 用課名找課（原本設計：若重名會命中第一筆）
  const course = (typeof COURSES !== "undefined")
    ? COURSES.find(c => c.name === selectedCourseName)
    : null;

  if (!course) { result.textContent = "課程資料錯誤，請重整頁面"; return; }

  // 1) 豁免帳號：最優先無條件通過（不看名單/日期/時間）
  if (isEmailExempt(emailRaw)) {
    const nameEx = (typeof STUDENTS !== "undefined" ? STUDENTS[emailRaw] : "") || "（豁免帳號）";
    try {
      await sendCheckin(nameEx, emailRaw, course.name, course.date, "準時");
      result.textContent = "打卡成功！（豁免帳號）";
    } catch {
      result.textContent = "打卡失敗：無法連線後端（請檢查 GAS 部署或網路）";
    }
    return;
  }

  // 2) 非豁免 → 檢查是否在名單中
  if (typeof STUDENTS === "undefined" || !STUDENTS[emailRaw]) {
    result.textContent = "打卡失敗：Email 不在名單中";
    return;
  }
  const name = STUDENTS[emailRaw];

  // 3) 檢查是不是今天這堂課
  if (!isToday(course.date)) {
    result.textContent = "打卡失敗：此課程不在今日";
    return;
  }

  // 4) 檢查課程時間範圍（提前 1 小時可打；一般課超過 10 分算遲到）
  const [start, end] = String(course.time).split("-");
  const startTime = timeToDate(course.date, start);
  const endTime   = timeToDate(course.date, end);
  const early     = new Date(startTime.getTime() - 60 * 60000); // 提前1小時
  const grace     = new Date(startTime.getTime() + 10 * 60000); // 開始後10分鐘

  let status = "準時";
  if (!course.exemptLateRule) {
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在可打卡時間內";
      return;
    } else if (now > grace) {
      status = "遲到";
    }
  } else {
    // 免遲到的場次，仍需在 early ~ end 範圍內
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
