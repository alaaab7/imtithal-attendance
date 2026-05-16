/**
 * لوحة التحكم - Admin Panel
 */

let currentPassword = '';
let currentData = null;

function el(id) { return document.getElementById(id); }

function escapeHTML(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function apiCall(action, data = {}) {
  const payload = JSON.stringify({ action, ...data });
  const body = new URLSearchParams();
  body.append('payload', payload);

  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'omit',
    body: body,
    redirect: 'follow'
  });

  if (!response.ok) throw new Error('HTTP ' + response.status);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    console.error('Invalid JSON response:', text.substring(0, 200));
    throw new Error('استجابة غير صالحة من الخادم');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('admin_pw');
  if (saved) {
    currentPassword = saved;
    tryLoadDashboard();
  }

  el('btnLogin').addEventListener('click', handleLogin);
  el('passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  el('btnRefresh').addEventListener('click', loadStats);
  el('btnExport').addEventListener('click', exportCSV);
  el('btnOpenSheet').addEventListener('click', openSheet);
  el('btnLogout').addEventListener('click', logout);
  el('btnSaveLocation').addEventListener('click', saveLocation);
  el('btnUseMyLocation').addEventListener('click', useMyLocation);
  el('btnOpenMap').addEventListener('click', openMap);
});

async function handleLogin() {
  const pw = el('passwordInput').value;
  if (!pw) return;
  el('btnLoginText').textContent = 'جاري التحقق...';
  el('btnLogin').disabled = true;
  currentPassword = pw;
  await tryLoadDashboard();
}

async function tryLoadDashboard() {
  try {
    const result = await apiCall('getStats', { password: currentPassword });
    el('btnLogin').disabled = false;
    el('btnLoginText').textContent = 'دخول';

    if (result.success) {
      sessionStorage.setItem('admin_pw', currentPassword);
      currentData = result;
      renderDashboard(result);
      el('loginScreen').classList.add('hidden');
      el('dashboard').classList.remove('hidden');
    } else {
      sessionStorage.removeItem('admin_pw');
      currentPassword = '';
      el('loginError').textContent = result.error || 'كلمة المرور غير صحيحة';
      el('loginError').classList.add('visible');
      el('passwordInput').focus();
      el('passwordInput').select();
    }
  } catch (err) {
    el('btnLogin').disabled = false;
    el('btnLoginText').textContent = 'دخول';
    el('loginError').textContent = 'فشل الاتصال: ' + err.message;
    el('loginError').classList.add('visible');
  }
}

function logout() {
  sessionStorage.removeItem('admin_pw');
  currentPassword = '';
  currentData = null;
  el('dashboard').classList.add('hidden');
  el('loginScreen').classList.remove('hidden');
  el('passwordInput').value = '';
}

async function loadStats() {
  const btn = el('btnRefresh');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = '⏳ تحديث...';
  try {
    const result = await apiCall('getStats', { password: currentPassword });
    btn.disabled = false;
    btn.textContent = original;
    if (result.success) {
      currentData = result;
      renderDashboard(result);
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function renderDashboard(data) {
  el('statToday').textContent = data.todayCount;
  el('statTotal').textContent = data.totalCount;
  el('statCompanies').textContent = data.companiesCount;
  el('todayLabel').textContent = 'تاريخ اليوم: ' + (data.today || '-');
  renderTable(data.todayList || []);
  renderLocation(data.location);
}

function renderLocation(loc) {
  if (!loc) return;
  el('locLat').value = loc.lat;
  el('locLng').value = loc.lng;
  el('locRadius').value = loc.radius;

  const statusEl = el('locationStatus');
  const statusText = el('locationStatusText');
  if (loc.isConfigured) {
    statusEl.className = 'location-status configured';
    statusText.textContent = 'الموقع مضبوط ✓';
    el('btnOpenMap').style.display = 'inline-flex';
  } else {
    statusEl.className = 'location-status not-configured';
    statusText.textContent = 'الموقع غير مضبوط — اضبطه الآن';
    el('btnOpenMap').style.display = 'none';
  }
}

function renderTable(list) {
  const container = el('tableContainer');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>لا يوجد حضور مسجّل لليوم</p></div>`;
    return;
  }
  const rows = list.map((row, idx) => {
    const badgeClass = row.status === 'مكرر' ? 'badge-warning' : 'badge-success';
    return `<tr>
      <td>${idx + 1}</td>
      <td>${escapeHTML(row.time)}</td>
      <td>${escapeHTML(row.name)}</td>
      <td>${escapeHTML(row.company)}</td>
      <td>${escapeHTML(row.jobTitle)}</td>
      <td class="text-mono">${escapeHTML(row.phone)}</td>
      <td class="text-mono">${escapeHTML(row.email)}</td>
      <td>${escapeHTML(String(row.distance))} م</td>
      <td><span class="badge ${badgeClass}">${escapeHTML(row.status)}</span></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table class="data-table"><thead><tr>
    <th>#</th><th>الوقت</th><th>الاسم</th><th>الشركة</th><th>المسمى</th><th>الجوال</th><th>الإيميل</th><th>المسافة</th><th>الحالة</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function saveLocation() {
  const lat = el('locLat').value.trim();
  const lng = el('locLng').value.trim();
  const radius = el('locRadius').value.trim();
  const result = el('locationResult');

  if (!lat || !lng || !radius) {
    showLocResult('يرجى تعبئة جميع الحقول', 'error');
    return;
  }

  el('btnSaveLocation').disabled = true;
  el('btnSaveLocation').textContent = '⏳ جاري الحفظ...';
  result.classList.add('hidden');

  try {
    const res = await apiCall('saveLocation', { password: currentPassword, lat, lng, radius });
    el('btnSaveLocation').disabled = false;
    el('btnSaveLocation').innerHTML = '💾 حفظ الموقع';
    if (res.success) {
      showLocResult('✓ تم حفظ الموقع بنجاح', 'success');
      renderLocation({ ...res.location, isConfigured: true });
      setTimeout(() => result.classList.add('hidden'), 3000);
    } else {
      showLocResult('✕ ' + (res.error || 'فشل الحفظ'), 'error');
    }
  } catch (err) {
    el('btnSaveLocation').disabled = false;
    el('btnSaveLocation').innerHTML = '💾 حفظ الموقع';
    showLocResult('✕ فشل الاتصال: ' + err.message, 'error');
  }
}

function useMyLocation() {
  const btn = el('btnUseMyLocation');
  if (!navigator.geolocation) {
    showLocResult('متصفحك لا يدعم خدمة الموقع', 'error');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '⏳ جاري التحديد...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      el('locLat').value = pos.coords.latitude.toFixed(6);
      el('locLng').value = pos.coords.longitude.toFixed(6);
      if (!el('locRadius').value) el('locRadius').value = '100';
      btn.disabled = false;
      btn.innerHTML = '📍 استخدام موقعي الحالي';
      showLocResult('✓ تم تحديد موقعك. اضغط حفظ لتثبيته.', 'success');
    },
    err => {
      btn.disabled = false;
      btn.innerHTML = '📍 استخدام موقعي الحالي';
      showLocResult('✕ تعذر تحديد موقعك: ' + err.message, 'error');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function openMap() {
  const lat = el('locLat').value;
  const lng = el('locLng').value;
  if (lat && lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

function openSheet() {
  if (currentData && currentData.sheetUrl) window.open(currentData.sheetUrl, '_blank');
}

function showLocResult(msg, type) {
  const r = el('locationResult');
  r.textContent = msg;
  r.className = 'location-result ' + type;
}

function exportCSV() {
  if (!currentData || !currentData.todayList || !currentData.todayList.length) {
    alert('لا يوجد بيانات للتصدير');
    return;
  }
  const headers = ['الوقت', 'الاسم', 'الشركة', 'المسمى الوظيفي', 'الجوال', 'الإيميل', 'المسافة (م)', 'الحالة'];
  const rows = currentData.todayList.map(r => [r.time, r.name, r.company, r.jobTitle, r.phone, r.email, r.distance, r.status]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => '"' + String(cell || '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'imtithal-attendance-' + (currentData.today || 'today') + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
