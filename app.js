/**
 * تطبيق تحضير امتثال - Client-side
 */

const state = {
  coords: null,
  accuracy: null,
  currentScreen: 'welcome'
};

function el(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => {
  captureLocationSilently();  // نلتقط الموقع للسجل فقط (بدون قيد)
  bindEvents();
  updateProgress(0);
});

// ============================================================
// API Client
// ============================================================

async function apiCall(action, data = {}) {
  const payload = JSON.stringify({ action, ...data });

  // URLSearchParams = simple CORS request (لا preflight) - يعمل مع Apps Script
  const body = new URLSearchParams();
  body.append('payload', payload);

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      body: body,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    // إجبار فك الترميز بـ UTF-8 (Apps Script يرجع UTF-8 لكن بدون charset header)
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error('Invalid JSON response:', text.substring(0, 200));
      throw new Error('استجابة غير صالحة من الخادم');
    }
  } catch (err) {
    console.error('apiCall error:', err);
    throw err;
  }
}

// ============================================================
// Geolocation
// ============================================================

// نلتقط الموقع بصمت للسجل فقط - بدون أي قيد أو حظر
function captureLocationSilently() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      state.accuracy = pos.coords.accuracy;
    },
    (err) => {
      // لا نمنع المستخدم - التحضير متاح من أي مكان
      console.log('Location not available (optional):', err.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// ============================================================
// Events
// ============================================================

function bindEvents() {
  el('btnStart').addEventListener('click', () => {
    switchScreen('form');  // متاح من أي مكان - بدون قيد الموقع
  });

  el('attendanceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateForm()) submitForm();
  });

  document.querySelectorAll('.input-field').forEach(input => {
    if (!input.id.startsWith('input')) return;
    input.addEventListener('input', () => {
      const field = lc(input.id.replace('input', ''));
      const err = el('error' + cap(field));
      if (err) err.classList.remove('visible');
      input.classList.remove('input-invalid');
    });
    input.addEventListener('blur', () => {
      if (!input.value.trim()) return;
      const field = lc(input.id.replace('input', ''));
      validateField(field);
    });
  });

  el('inputPhone').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // رقم الهوية - أرقام فقط (10 أرقام)
  el('inputIdNumber').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
}

// ============================================================
// Validation
// ============================================================

const VALIDATORS = {
  name:     { val: v => v.length >= 3,                              msg: 'الرجاء إدخال الاسم الكامل (3 أحرف على الأقل)' },
  idNumber: { val: v => /^\d{10}$/.test(v.replace(/\D/g, '')),      msg: 'يجب أن يكون رقم الهوية مكون من عشرة أرقام' },
  phone:    { val: v => /^\d{10}$/.test(v.replace(/\D/g, '')),      msg: 'يجب أن يكون رقم الجوال مكون من عشرة أرقام' },
  email:    { val: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),       msg: 'صيغة الإيميل غير صحيحة' },
  workCity: { val: v => v.length >= 2,                              msg: 'الرجاء إدخال مدينة العمل' }
};

function lc(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function validateField(field) {
  const input = el('input' + cap(field));
  const err = el('error' + cap(field));
  const value = input.value.trim();

  if (!VALIDATORS[field].val(value)) {
    err.textContent = VALIDATORS[field].msg;
    err.classList.add('visible');
    input.classList.add('input-invalid');
    return false;
  }
  err.classList.remove('visible');
  input.classList.remove('input-invalid');
  return true;
}

function validateForm() {
  let valid = true, firstInvalid = null;
  for (const field in VALIDATORS) {
    if (!validateField(field)) {
      if (!firstInvalid) firstInvalid = el('input' + cap(field));
      valid = false;
    }
  }
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

function getFormData() {
  return {
    name: el('inputName').value.trim(),
    idNumber: el('inputIdNumber').value.trim(),
    phone: el('inputPhone').value.trim(),
    email: el('inputEmail').value.trim(),
    workCity: el('inputWorkCity').value.trim()
  };
}

// ============================================================
// Screen navigation
// ============================================================

const PROGRESS_MAP = { welcome: 0, form: 50, loading: 75, success: 100, outside: 100, error: 100, 'no-location': 0 };

function switchScreen(name) {
  const current = document.querySelector('.screen.active');
  const next = el('screen-' + name);
  if (!next) return;
  if (current && current !== next) {
    current.classList.remove('active');
    next.classList.add('active');
  } else {
    next.classList.add('active');
  }
  state.currentScreen = name;
  updateProgress(PROGRESS_MAP[name] || 0);
  window.scrollTo({ top: 0 });
  if (name === 'form') setTimeout(() => el('inputName').focus(), 200);
}

function updateProgress(pct) {
  el('progressBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ============================================================
// Form submission
// ============================================================

async function submitForm() {
  switchScreen('loading');

  const data = getFormData();
  const payload = {
    ...data,
    // الموقع اختياري - للسجل فقط (null لو ما توفر)
    lat: state.coords ? state.coords.lat : null,
    lng: state.coords ? state.coords.lng : null,
    accuracy: state.accuracy
  };

  try {
    const result = await apiCall('submit', payload);
    handleSubmitResult(result);
  } catch (err) {
    console.error('Submit error:', err);
    showError('فشل الاتصال بالخادم. حاول مرة أخرى.');
  }
}

function handleSubmitResult(result) {
  if (!result) {
    showError('استجابة غير صحيحة');
    return;
  }
  if (result.success) {
    showSuccess(result);
  } else if (result.error === 'outside_location') {
    showOutside(result);
  } else {
    showError(result.error || result.message || 'حدث خطأ');
  }
}

function showSuccess(result) {
  const meta = result.timestamp.date + ' • ' + result.timestamp.time;
  if (result.isDuplicate && result.duplicateInfo) {
    el('thanksSubtitle').textContent = 'تم تسجيل حضورك (إضافي)';
    el('thanksMetaInline').textContent = 'مسجل سابقاً في ' + result.duplicateInfo.time + ' • ' + meta;
  } else {
    el('thanksSubtitle').textContent = 'تم تسجيل حضورك بنجاح';
    el('thanksMetaInline').textContent = meta;
  }
  switchScreen('success');
}

function showOutside(result) {
  el('currentDistance').textContent = result.distance + ' متر';
  el('allowedDistance').textContent = result.allowedRadius + ' متر';
  el('outsideMessage').textContent = result.message;
  switchScreen('outside');
}

function showError(msg) {
  el('errorMessage').textContent = msg;
  switchScreen('error');
}
