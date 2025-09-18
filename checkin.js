// -------------------- 工具：時間與日期 --------------------

// 取得台灣現在時間（避免本機時區亂掉）
const taiwanTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
let now = new Date(taiwanTime);

// "YYYY-MM-DD" + "HH:mm" -> Date（固定 +08:00）
function timeToDate(dateStr, timeStr) {
  const [h, m] = timeStr.split(":");
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+08:00`);
}

// 判斷 dateStr 是否為今日（以台北時區）
function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

// 每次送出前刷新 now（避免使用者頁面開很久）
function refreshNow() {
  const t = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
  now = new Date(t);
}

// -------------------- 工具：豁免名單判斷 --------------------

// 兼容：EXEMPT_EMAILS 可能是 Array 或 Set，且大小寫不敏感
function isEmailExempt(emailRaw) {
  if (typeof EXEMPT_EMAILS === "undefined") return false;
  const email = String(emailRaw).trim().toLowerCase();
  // Set 走 has；Array 走 includes
  if (EXEMPT_EMAILS instanceof Set) return EXEMPT_EMAILS.has(email);
  if (Array.isArray(EXEMPT_EMAILS)) {
    return EXEMPT_EMAILS.map(s => String(s).trim().toLowerCase()).includes(email);
  }
  return false;
}

// -------------------- 送出到 Google Apps Script --------------------

function sendCheckin(name, email, courseName, date, status) {
  const payload = { name, email, course: courseName, date, status };

  // 重要：不自行指定 Content-Type，避免 CORS preflight
  return fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    body: JSON.stringify(payload)
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

// -------------------- 表單行為 --------------------

document.getElementById("checkinForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  refreshNow();

  const result = document.getElementById("result");
  result.textContent = "";

  const emailInput = document.getElementById("email");
  const courseSelect = document.getElementById("courseSelect");

  const emailRaw = (emailInput.value || "").trim();
  const emailLC = emailRaw.toLowerCase();

  if (!emailRaw) {
    result.textContent = "請輸入 Email";
    return;
  }

  const selectedCourse = courseSelect.value;
  const course = (typeof COURSES !== "undefined") ? COURSES.find(c => c.name === selectedCourse) : null;
  if (!course) {
    result.textContent = "請選擇課程";
    return;
  }

  // 1) 豁免帳號：最優先且無條件通過（不看名單、不看日期、不看時間）
  if (isEmailExempt(emailRaw)) {
    const name = (typeof STUDENTS !== "undefined" ? STUDENTS[emailRaw] : "") || "（豁免帳號）";
    console.log("✅ 豁免帳號，無條件通過打卡");
    try {
      await sendCheckin(name, emailRaw, course.name, course.date, "準時");
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

  // 4) 檢查課程時間範圍
  const [start, end] = String(course.time).split("-");
  const startTime = timeToDate(course.date, start);
  const endTime   = timeToDate(course.date, end);
  const early     = new Date(startTime.getTime() - 60 * 60000); // 提前 1 小時
  const grace     = new Date(startTime.getTime() + 10 * 60000); // 開始後 10 分鐘

  let status = "準時";

  if (!course.exemptLateRule) {
    // 一般課：早於 early 或晚於 end → 擋；超過 grace → 遲到
    if (now < early || now > endTime) {
      result.textContent = "打卡失敗：目前不在可打卡時間內";
      return;
    } else if (now > grace) {
      status = "遲到";
    }
  } else {
    // 拍攝/呈現等：仍須落在 early~end 範圍，但不計遲到（維持你原設計）
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
    result.textContent = "打卡失敗：無法連線後端（請檢查 GAS 部署或網路）";
  }
});

// -------------------- 載入課程選單（若頁面未先塞） --------------------

(function mountCourseOptions() {
  const select = document.getElementById("courseSelect");
  if (!select) return;
  if (!select.options || select.options.length === 0) {
    if (typeof COURSES === "undefined") return;
    COURSES.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = `${c.date}｜${c.name}`;
      select.appendChild(opt);
    });
  }
})();
