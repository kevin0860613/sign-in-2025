document.getElementById("checkinForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const emailRaw = document.getElementById("email").value.trim();
  const email = emailRaw.toLowerCase();                 // ✅ 大小寫不敏感
  const selectedCourse = document.getElementById("courseSelect").value;
  const course = COURSES.find(c => c.name === selectedCourse);
  const result = document.getElementById("result");
  result.textContent = "";

  if (!emailRaw) {
    result.textContent = "請輸入 Email";
    return;
  }
  if (!course) {
    result.textContent = "請選擇課程";
    return;
  }

  // ✅ 豁免帳號：最優先＆無條件通過（不看名單/日期/時間）
  const isExempt = EXEMPT_EMAILS.has(email);
  if (isExempt) {
    const name = STUDENTS[emailRaw] || "（豁免帳號）";
    console.log("✅ 豁免帳號，無條件通過打卡");
    sendCheckin(name, emailRaw, course.name, course.date, "準時");
    result.textContent = "打卡成功！（豁免帳號）";
    return;
  }

  // ✅ 非豁免 → 檢查是否在名單中（原本邏輯保留）
  const name = STUDENTS[emailRaw];
  if (!name) {
    result.textContent = "打卡失敗：Email 不在名單中";
    return;
  }

  // ✅ 檢查是不是今天的課程
  if (!isToday(course.date)) {
    result.textContent = "打卡失敗：此課程不在今日";
    return;
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

  sendCheckin(name, emailRaw, course.name, course.date, status);
  result.textContent = "打卡成功！歡迎上課～";
});

