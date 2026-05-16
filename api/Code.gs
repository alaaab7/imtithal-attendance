/**
 * نظام تحضير امتثال - API Backend
 * يستقبل البيانات من Vercel/GitHub Pages ويحفظ في Google Sheet
 *
 * النشر:
 * 1. انسخ هذا الملف لمشروع Apps Script
 * 2. Deploy → New deployment → Web app
 * 3. Execute as: Me  |  Access: Anyone
 * 4. انسخ الـ URL واستخدمه في web/config.js
 */

// ============================================================
// الإعدادات
// ============================================================

const CONFIG = {
  ADMIN_PASSWORD: 'admin1234',      // غيّرها لكلمة سرية
  SHEET_NAME: 'Attendance',
  TIMEZONE: 'Asia/Riyadh',
  // الموقع الافتراضي - يُحدّث من لوحة الأدمن
  DEFAULT_LAT: 24.7136,
  DEFAULT_LNG: 46.6753,
  DEFAULT_RADIUS_M: 100
};

const PROPS_KEYS = {
  LAT: 'TARGET_LAT',
  LNG: 'TARGET_LNG',
  RADIUS: 'ALLOWED_RADIUS_M'
};

// ============================================================
// نقطة الدخول الرئيسية - يستقبل كل الطلبات
// ============================================================

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    let action, data;

    // POST request مع JSON body
    if (e && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      action = body.action;
      data = body;
    }
    // GET request مع query parameters
    else if (e && e.parameter) {
      action = e.parameter.action;
      data = e.parameter;
    }

    if (!action) action = 'health';

    let result;
    switch (action) {
      case 'submit':       result = submitAttendance(data); break;
      case 'getConfig':    result = getPublicConfig(); break;
      case 'getStats':     result = getStats(data.password); break;
      case 'saveLocation': result = saveLocation(data.password, data.lat, data.lng, data.radius); break;
      case 'resetLocation':result = resetLocation(data.password); break;
      case 'health':       result = { success: true, status: 'ok', timestamp: new Date().toISOString() }; break;
      default:             result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    console.error('handleRequest error:', err);
    return jsonResponse({ success: false, error: err.message || String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// الإعدادات العامة (يستخدمها الفرونت إند)
// ============================================================

function getPublicConfig() {
  const loc = getActiveLocation();
  return {
    success: true,
    location: {
      lat: loc.lat,
      lng: loc.lng,
      radius: loc.radius,
      isConfigured: loc.isConfigured
    },
    companyName: 'امتثال'
  };
}

// ============================================================
// استقبال التحضير
// ============================================================

function submitAttendance(data) {
  // التحقق من البيانات
  const required = ['name', 'company', 'phone', 'email', 'jobTitle', 'lat', 'lng'];
  for (const field of required) {
    if (!data[field] && data[field] !== 0) {
      return { success: false, error: 'بيانات ناقصة: ' + field };
    }
  }

  const name = String(data.name).trim();
  const company = String(data.company).trim();
  const phone = String(data.phone).trim();
  const email = String(data.email).trim().toLowerCase();
  const jobTitle = String(data.jobTitle).trim();
  const userLat = parseFloat(data.lat);
  const userLng = parseFloat(data.lng);
  const accuracy = data.accuracy ? parseFloat(data.accuracy) : null;

  // التحقق من الإيميل
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'صيغة الإيميل غير صحيحة' };
  }

  // التحقق من الجوال (10 أرقام)
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'يجب أن يكون رقم الجوال مكون من عشرة أرقام' };
  }

  // إعدادات الموقع
  const loc = getActiveLocation();
  if (!loc.isConfigured) {
    return { success: false, error: 'لم يتم ضبط موقع التحضير بعد. تواصل مع المسؤول.' };
  }

  // المسافة
  const distance = haversineDistance(loc.lat, loc.lng, userLat, userLng);
  const effectiveRadius = loc.radius + (accuracy && accuracy < 200 ? accuracy : 0);

  if (distance > effectiveRadius) {
    return {
      success: false,
      error: 'outside_location',
      distance: Math.round(distance),
      allowedRadius: loc.radius,
      message: 'أنت خارج موقع التحضير. تبعد ' + Math.round(distance) + ' متر عن الموقع المسموح.'
    };
  }

  // التحقق من التكرار
  const duplicate = checkDuplicateToday(email);

  // الحفظ في الشيت
  const sheet = getOrCreateSheet();
  const now = new Date();
  const tz = CONFIG.TIMEZONE;
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');
  const status = duplicate ? 'مكرر' : 'جديد';

  sheet.appendRow([
    now, dateStr, timeStr, name, company, phone, email, jobTitle,
    userLat, userLng, Math.round(distance), status
  ]);

  return {
    success: true,
    isDuplicate: !!duplicate,
    duplicateInfo: duplicate,
    timestamp: {
      date: formatArabicDate(now),
      time: formatArabicTime(now),
      timestamp: now.toISOString()
    },
    name: name,
    distance: Math.round(distance)
  };
}

// ============================================================
// إدارة الموقع (PropertiesService)
// ============================================================

function getActiveLocation() {
  const props = PropertiesService.getScriptProperties();
  const lat = parseFloat(props.getProperty(PROPS_KEYS.LAT));
  const lng = parseFloat(props.getProperty(PROPS_KEYS.LNG));
  const radius = parseFloat(props.getProperty(PROPS_KEYS.RADIUS));

  return {
    lat: isNaN(lat) ? CONFIG.DEFAULT_LAT : lat,
    lng: isNaN(lng) ? CONFIG.DEFAULT_LNG : lng,
    radius: isNaN(radius) ? CONFIG.DEFAULT_RADIUS_M : radius,
    isConfigured: !isNaN(lat) && !isNaN(lng)
  };
}

function saveLocation(password, lat, lng, radius) {
  if (!checkAdminPassword(password)) {
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const radiusNum = parseFloat(radius);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return { success: false, error: 'خط العرض غير صحيح (-90 إلى 90)' };
  }
  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return { success: false, error: 'خط الطول غير صحيح (-180 إلى 180)' };
  }
  if (isNaN(radiusNum) || radiusNum < 10 || radiusNum > 5000) {
    return { success: false, error: 'نصف القطر يجب أن يكون بين 10 و 5000 متر' };
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    [PROPS_KEYS.LAT]: String(latNum),
    [PROPS_KEYS.LNG]: String(lngNum),
    [PROPS_KEYS.RADIUS]: String(radiusNum)
  });

  return {
    success: true,
    location: { lat: latNum, lng: lngNum, radius: radiusNum, isConfigured: true }
  };
}

function resetLocation(password) {
  if (!checkAdminPassword(password)) {
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  }
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROPS_KEYS.LAT);
  props.deleteProperty(PROPS_KEYS.LNG);
  props.deleteProperty(PROPS_KEYS.RADIUS);
  return { success: true };
}

// ============================================================
// التحقق من التكرار
// ============================================================

function checkDuplicateToday(email) {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const tz = CONFIG.TIMEZONE;
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (row[1] === today && String(row[6] || '').toLowerCase() === email) {
      return { time: row[2], date: row[1] };
    }
  }
  return null;
}

// ============================================================
// خوارزمية Haversine
// ============================================================

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// إدارة Google Sheet
// ============================================================

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'الطابع الزمني', 'التاريخ', 'الوقت', 'الاسم', 'اسم الشركة',
      'رقم الجوال', 'الإيميل', 'المسمى الوظيفي', 'خط العرض', 'خط الطول',
      'المسافة (م)', 'الحالة'
    ]);
    const headerRange = sheet.getRange(1, 1, 1, 12);
    headerRange.setBackground('#d7a562')
               .setFontColor('#00080b')
               .setFontWeight('bold')
               .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
    [160, 100, 80, 150, 150, 120, 200, 130, 120, 120, 100, 80].forEach((w, i) => {
      sheet.setColumnWidth(i + 1, w);
    });
  }
  return sheet;
}

// ============================================================
// لوحة التحكم
// ============================================================

function checkAdminPassword(password) {
  return password === CONFIG.ADMIN_PASSWORD;
}

function getStats(password) {
  if (!checkAdminPassword(password)) {
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  }

  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  const loc = getActiveLocation();
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  if (lastRow < 2) {
    return {
      success: true,
      todayCount: 0, totalCount: 0, companiesCount: 0,
      todayList: [], today: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      sheetUrl: sheetUrl,
      location: { lat: loc.lat, lng: loc.lng, radius: loc.radius, isConfigured: loc.isConfigured }
    };
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  let todayCount = 0;
  const todayList = [];
  const companies = new Set();

  data.forEach(row => {
    if (row[1] === today) {
      todayCount++;
      todayList.push({
        time: row[2], name: row[3], company: row[4], phone: row[5],
        email: row[6], jobTitle: row[7], distance: row[10], status: row[11]
      });
    }
    if (row[4]) companies.add(String(row[4]).trim().toLowerCase());
  });

  todayList.reverse();

  return {
    success: true,
    todayCount: todayCount,
    totalCount: data.length,
    companiesCount: companies.size,
    todayList: todayList.slice(0, 100),
    today: today,
    sheetUrl: sheetUrl,
    location: { lat: loc.lat, lng: loc.lng, radius: loc.radius, isConfigured: loc.isConfigured }
  };
}

// ============================================================
// مساعدات التنسيق العربي
// ============================================================

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatArabicDate(date) {
  const tz = CONFIG.TIMEZONE;
  const day = Utilities.formatDate(date, tz, 'd');
  const month = parseInt(Utilities.formatDate(date, tz, 'M'), 10);
  const year = Utilities.formatDate(date, tz, 'yyyy');
  const dayOfWeek = parseInt(Utilities.formatDate(date, tz, 'u'), 10) % 7;
  return ARABIC_DAYS[dayOfWeek] + '، ' + day + ' ' + ARABIC_MONTHS[month - 1] + ' ' + year;
}

function formatArabicTime(date) {
  const tz = CONFIG.TIMEZONE;
  const hour24 = parseInt(Utilities.formatDate(date, tz, 'H'), 10);
  const min = Utilities.formatDate(date, tz, 'mm');
  const period = hour24 >= 12 ? 'م' : 'ص';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return hour12 + ':' + min + ' ' + period;
}
