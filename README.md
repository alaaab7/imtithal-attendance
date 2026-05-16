# نظام تحضير امتثال

نظام تحضير ذكي بالباركود + التحقق من الموقع الجغرافي + حفظ في Google Sheets.

## 📁 هيكل المشروع

```
.
├── web/                    ← الواجهة الأمامية (Vercel)
│   ├── index.html          ← صفحة الفورم
│   ├── admin.html          ← لوحة الأدمن
│   ├── style.css           ← التصميم
│   ├── admin.css           ← أنماط الأدمن
│   ├── app.js              ← منطق الفورم
│   ├── admin.js            ← منطق الأدمن
│   ├── config.js           ← رابط API
│   ├── vercel.json         ← إعدادات Vercel
│   └── assets/             ← الصور
│       ├── logo.png
│       ├── welcome-bg.jpg
│       ├── form-bg.jpg
│       └── thanks-bg.jpg
│
└── api/
    └── Code.gs             ← Apps Script API (يُنشر على Google)
```

## 🚀 خطوات النشر

### 1️⃣ Apps Script (الـ Backend)

1. أنشئ Google Sheet جديد
2. من القائمة: **Extensions → Apps Script**
3. الصق محتوى `api/Code.gs` في ملف `Code.gs`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. انسخ **Web app URL**

### 2️⃣ Vercel (الـ Frontend)

1. ارفع المجلد `web/` على GitHub
2. في [vercel.com](https://vercel.com)، اربط الـ Repo
3. **Root Directory**: `web`
4. اضغط Deploy

### 3️⃣ ربط الـ Frontend بـ Backend

في ملف `web/config.js`، عدّل:
```javascript
API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
```

### 4️⃣ ضبط الموقع الجغرافي

1. افتح `https://your-vercel.app/admin.html`
2. كلمة المرور: `admin1234`
3. في قسم "إعدادات موقع التحضير": اضغط "استخدام موقعي الحالي"
4. اضغط حفظ

### 5️⃣ إنشاء QR Code

استخدم: [qr-code-generator.com](https://www.qr-code-generator.com/)

اللصق: رابط Vercel (مثلاً: `https://imtithal-attendance.vercel.app`)

## ⚙️ تخصيص

### كلمة مرور الأدمن
في `api/Code.gs`:
```javascript
const CONFIG = {
  ADMIN_PASSWORD: 'كلمة-مرورك-السرية',
  ...
};
```

### الألوان
في `web/style.css` → `:root { --c-gold, --c-black ... }`

## 📱 التقنيات

- **Frontend**: HTML5, CSS3, Vanilla JS (لا frameworks)
- **Backend**: Google Apps Script
- **Storage**: Google Sheets
- **CDN**: Vercel
- **التحقق من الموقع**: Browser Geolocation API + Haversine formula

## 🆓 التكلفة

**صفر ريال** - كل الخدمات مجانية:
- Vercel: Free tier (100GB bandwidth/شهر)
- Google Apps Script: 20,000 طلب/يوم مجاناً
- Google Sheets: مجاني للأبد
