// Taiwan time now
const taiwanTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" });
const now = new Date(taiwanTime);

function timeToDate(dateStr, timeStr) {
  const [h, m] = timeStr.split(":");
  return new Date(`${dateStr}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00+08:00`);
}

function isToday(dateStr) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  return dateStr === today;
}

document.getElementById("checkinForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const selectedCourse = document.getElementById("courseSelect").value;
  const course = COURSES.find(c => c.name === selectedCourse);
  const result = document.getElementById("result");
  result.textContent = "";

  if (!email) return result.textContent = "請輸入 Email";

  const name = STUDENTS[email];
  const isExempt = EXEMPT_EMAILS.includes(email);

  if (!name && !isExempt) {
    return result.textContent = "打卡失敗：Email 不在名單中";
  }

  // 豁免帳號：跳過所有時間與日期限制，直接通過
  if (isExempt) {
    sendCheckin(name || "（豁免帳號）", email, course.name, course.date, "準時");
    result.textContent = "打卡成功！（豁免帳號）";
    return;
  }

  // 非豁免帳號，檢查日期
  if (!isToday(course.date)) {
    return result.textContent = "打卡失敗：此課程不在今日";
  }

  // 檢查時間範圍
  const [start, end] = course.time.split("-");
  const startTime = timeToDate(course.date, start);
  const endTime = timeToDate(course.date, end);
  const early = new Date(startTime.getTime() - 60 * 60000); // 提前 1 小時
  const grace = new Date(startTime.getTime() + 10 * 60000); // 課後 10 分鐘

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

// ✅ 統一送出打卡資料
function sendCheckin(name, email, courseName, date, status) {
  const payload = {
    name,
    email,
    course: courseName,
    date,
    status
