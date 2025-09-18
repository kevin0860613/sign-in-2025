// 所有學生名單（email → name）
const STUDENTS = {
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

  // 測試帳號（也列在名單內）
  "b10415041@gmail.com": "凱文",        // ✅ 豁免
  "cz0806.phone@gmail.com": "小逸",      // ✅ 豁免
  "2024tfciaclass@gmail.com": "星引力"   // ❌ 不豁免
};

// 豁免遲到與日期限制的帳號
const EXEMPT_EMAILS = [
  "b10415041@gmail.com",     // 凱文
  "cz0806.phone@gmail.com"   // 小逸
];
