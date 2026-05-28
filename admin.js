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

  // إجبار UTF-8 decoding (Apps Script يرسل UTF-8 لكن بدون charset header)
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);

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
  el('statCompanies').textContent = data.citiesCount;
  el('todayLabel').textContent = 'تاريخ اليوم: ' + (data.today || '-');
  renderTable(data.todayList || []);
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
      <td class="text-mono">${escapeHTML(row.idNumber)}</td>
      <td class="text-mono">${escapeHTML(row.phone)}</td>
      <td class="text-mono">${escapeHTML(row.email)}</td>
      <td>${escapeHTML(row.workCity)}</td>
      <td><span class="badge ${badgeClass}">${escapeHTML(row.status)}</span></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table class="data-table"><thead><tr>
    <th>#</th><th>الوقت</th><th>الاسم</th><th>رقم الهوية</th><th>الجوال</th><th>الإيميل</th><th>مدينة العمل</th><th>الحالة</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function openSheet() {
  if (currentData && currentData.sheetUrl) window.open(currentData.sheetUrl, '_blank');
}

function exportCSV() {
  if (!currentData || !currentData.todayList || !currentData.todayList.length) {
    alert('لا يوجد بيانات للتصدير');
    return;
  }
  const headers = ['الوقت', 'الاسم', 'رقم الهوية', 'الجوال', 'الإيميل', 'مدينة العمل', 'الحالة'];
  const rows = currentData.todayList.map(r => [r.time, r.name, r.idNumber, r.phone, r.email, r.workCity, r.status]);
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
