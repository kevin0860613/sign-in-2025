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

  const isValid = VALID_STUDENTS.includes(email);
  const isExempt = EXEMPT_STUDENTS.includes(email);
  const isTest = TEST_STUDENTS.includes(email);

  if (!isValid && !isExempt && !isTest) {
    return result.textContent = "打卡失敗：Email 不在名單中";
  }

  if (!isToday(course.date) && !isExempt) {
    return result.textContent = "打卡失敗：此課程不在今日";
  }

  const [start, end] = course.time.split("-");
  const startTime = timeToDate(course.date, start);
  const endTime = timeToDate(course.date, end);
  const early = new Date(startTime.getTime() - 60 * 60000); // 提前 1 小時
  const grace = new Date(startTime.getTime() + 10 * 60000); // 課後 10 分鐘

  let status = "準時";

  if (!isExempt && !course.exemptLateRule) {
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

  const nameMap = {
    "quartararorossi2046@gmail.com": "蕭文彥",
    "a28616319@yahoo.com.tw": "吳秉翰",
    "a82452898@gmail.com": "林可馨",
    "rex940723@gmail.com": "魏晨名",
    "nmeknne23@gmail.com": "李宜珊",
    "kyrayehsoul@gmail.com": "葉吟瑄",
    "annie20021117@gmail.com": "劉安晴",
    "1070903@gmail.com": "謝大軍",
    "clara3333333@gmail.com": "黃榆珊",
    "cchangray@gmail.com": "張玴睿",
    "b10415041@gmail.com": "凱文",
    "cz0806.phone@gmail.com": "小逸",
    "2024tfciaclass@gmail.com": "星引力"
  };

  const payload = {
    name: nameMap[email] || "（未知）",
    email: email,
    course: course.name,
    date: course.date,
    status: status
  };

  // ✅ 改成你自己的 Google Apps Script Web App URL
  fetch("https://script.google.com/macros/s/AKfycbyj3h3oq2B9qYCkKuZLwo4IjPKs1_CvVELDCN0c9WbXQVuN6-Rc4KpmYmjdTJMNNCHVrQ/exec", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  result.textContent = "打卡成功！歡迎上課～";
});

window.onload = () => {
  const select = document.getElementById("courseSelect");
  COURSES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.date}｜${c.name}`;
    select.appendChild(opt);
  });
};
