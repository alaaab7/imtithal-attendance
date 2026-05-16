# نظام تحضير امتثال

نظام تحضير ذكي بالباركود + التحقق من الموقع الجغرافي + حفظ في Google Sheets.

## 📁 هيكل المشروع

```
.
├── index.html          ← صفحة الفورم
├── admin.html          ← لوحة الأدمن
├── style.css           ← التصميم
├── admin.css           ← أنماط الأدمن
├── app.js              ← منطق الفورم
├── admin.js            ← منطق الأدمن
├── config.js           ← رابط API ← عدّله بعد نشر Apps Script
├── vercel.json         ← إعدادات Vercel
├── assets/             ← الصور
├── api/
│   └── Code.gs         ← Apps Script API (يُنشر على Google)
└── README.md
```

## 🚀 خطوات النشر

### 1️⃣ Apps Script Backend

1. أنشئ Google Sheet جديد
2. **Extensions → Apps Script**
3. الصق محتوى `api/Code.gs` في الـ `Code.gs`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. انسخ Web app URL

### 2️⃣ Vercel Frontend

1. ارفع على GitHub: `git push`
2. [vercel.com](https://vercel.com) → Import Project → Deploy
3. Vercel سينشر تلقائياً (لا حاجة لإعدادات إضافية)

### 3️⃣ ربط Frontend بـ Backend

في `config.js`:
```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/YOUR_ID/exec'
};
```

### 4️⃣ ضبط الموقع الجغرافي

افتح `https://your-vercel.app/admin.html`
- كلمة المرور: `admin1234`
- اضغط "استخدام موقعي الحالي" → "حفظ الموقع"

### 5️⃣ QR Code

استخدم [qr-code-generator.com](https://www.qr-code-generator.com/)
- اللصق: رابط Vercel

## 📱 التقنيات

- **Frontend**: HTML5, CSS3, Vanilla JS
- **Backend**: Google Apps Script
- **Storage**: Google Sheets
- **CDN**: Vercel (global edge network)
- **Geolocation**: Browser API + Haversine formula

## 🆓 التكلفة

**صفر ريال** - كل الخدمات مجانية.
