// -------------------- 工具：時間與日期（保留你原本邏輯） --------------------
const taiwanTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
let now = new Date(taiwanTime);

function timeToDate(dateStr, timeStr) {
  const [h, m] = timeStr.split(":");
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+08:00`);
}

function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

function refreshNow() {
  const t = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
  now = new Date(t);
}

// -------------------- 豁免名單判斷（相容 Array / Set，大小寫不敏感） --------------------
function isEmailExempt(emailRaw) {
  if (typeof EXEMPT_EMAILS === "undefined") return false;
  const email = String(emailRaw).trim().toLowerCase();
  if (EXEMPT_EMAILS instanceof Set) return EXEMPT_EMAILS.has(email);
  if (Array.isArray(EXEMPT_EMAILS)) {
    return EXEMPT_EMAILS.some(s => String(s).trim().toLowerCase() === email);
  }
  return false;
}

// -------------------- 傳送到 Google Apps Script（避免 CORS preflight） --------------------
function sendCheckin(name, email, courseName, date, status) {
  const payload = { name, email, course: courseName, date, status };

  return fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    // 不手動設 Content-Type，讓瀏覽器送 text/plain，避免 preflight
    body: JSON.stringify(payload)
  })
  .then(r => r.text())
  .then(t => { console.log("GAS 回應：", t); return t; });
}

// -------------------- 表單送出（沿用你原本的「用課名找課」） --------------------
document.getElementById("checkinForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  refreshNow();

  const result = document.getElementById("result");
  result.textContent = "";

  const emailRaw = (document.getElementById("email").value || "").trim();
  const emailLC  = emailRaw.toLowerCase();
  const selectedCourseName = document.getElementById("courseSelect").value;

  if (!emailRaw) { result.textContent = "請輸入 Email"; return; }
  if (!selectedCourseName) { result.textContent = "請選擇課程"; return; }

  // ✅ 這裡沿用你最初的做法：用「課名」去找課（即使重名會命中第一筆，也照你原本邏輯）
  const course = (typeof COURSES !== "undefined")
    ? COURSES.find(c => c.name === selectedCourseName)
    : null;

  if (!course) { result.textContent = "課程資料錯誤，請重整頁面"; return; }

  // ✅ 豁免帳號：最優先無條件通過（不看名單/日期/時間）
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

  // ✅ 非豁免 → 檢查是否在名單中
  if (typeof STUDENTS === "undefined" || !STUDENTS[emailRaw]) {
    result.textContent = "打卡失敗：Email 不在名單中";
    return;
  }
  const name = STUDENTS[emailRaw];

  // ✅ 檢查是不是今天的課程
  if (!isToday(course.date)) {
    result.textContent = "打卡失敗：此課程不在今日";
    return;
  }

  // ✅ 檢查課程時間範圍（維持你原本的提早1小時、開課10分鐘寬限）
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
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在打卡有效時間範圍";
      return;
    }
  }

  // ✅ 送出
  try {
    await sendCheckin(name, emailRaw, course.name, course.date, status);
    result.textContent = "打卡成功！歡迎上課～";
  } catch {
    result.textContent = "打卡失敗：無法連線後端（請檢查 GAS 部署或網路）";
  }
});
