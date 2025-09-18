// ✅ 取得台灣時間
const taiwanTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
const now = new Date(taiwanTime);

// 🕓 將字串時間轉換為 Date
function timeToDate(dateStr, timeStr) {
  const [h, m] = timeStr.split(":");
  return new Date(`${dateStr}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00+08:00`);
}

// 📅 判斷是否為今日
function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

// 🚀 綁定表單送出事件
document.getElementById("checkinForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const selectedCourse = document.getElementById("courseSelect").value;
  const course = COURSES.find(c => c.name === selectedCourse);
  const result = document.getElementById("result");
  result.textContent = "";

  if (!email) return result.textContent = "請輸入 Email";

  const name = STUDENTS[email];
  const isExempt = typeof EXEMPT_EMAILS !== 'undefined' && EXEMPT_EMAILS.includes(email);

  // ✅ 如果不是名單 & 也不是豁免，就擋下來
  if (!name && !isExempt) {
    return result.textContent = "打卡失敗：Email 不在名單中";
  }

  // ✅ 豁免帳號：直接跳過所有時間規則
  if (isExempt) {
    console.log("✅ 豁免帳號，無條件通過打卡");
    sendCheckin(name || "（豁免帳號）", email, course.name, course.date, "準時");
    result.textContent = "打卡成功！（豁免帳號）";
    return;
  }

  // ✅ 檢查是不是今天的課程
  if (!isToday(course.date)) {
    return result.textContent = "打卡失敗：此課程不在今日";
  }

  // ✅ 檢查課程時間範圍
  const [start, end] = course.time.split("-");
  const startTime = timeToDate(course.date, start);
  const endTime = timeToDate(course.date, end);
  const early = new Date(startTime.getTime() - 60 * 60000); // 提前1小時
  const grace = new Date(startTime.getTime() + 10 * 60000); // 開始後10分鐘

  let status = "準時";

  if (!course.exemptLateRule) {
    if (now < early || now > endTime) {
      return result.textContent = "打卡失敗：目前不在可打卡時間內";
    } else if (now > grace) {
      status = "遲到";
    }
  } else {
    if (now < early || now > endTime) {
      return result.textContent = "打卡失敗：目前不在打卡有效時間範圍";
    }
  }

  sendCheckin(name, email, course.name, course.date, status);
  result.textContent = "打卡成功！歡迎上課～";
});

// ✅ 傳送打卡資料到 Google Sheet
function sendCheckin(name, email, courseName, date, status) {
  const payload = {
    name,
    email,
    course: courseName,
    date,
    status
  };

  fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

// ⏳ 載入課程清單
window.onload = () => {
  const select = document.getElementById("courseSelect");
  COURSES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.date}｜${c.name}`;
    select.appendChild(opt);
  });
};
