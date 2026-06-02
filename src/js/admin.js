// ===== CONFIG =====
const PERMISSIONS = {
  Superadmin: ['approve', 'approve_discipline', 'approve_participant', 'confirm_payment', 'reject_payment', 'cancel', 'visitor_approval', 'view_slip', 'view_detail', 'export', 'print', 'manage_users', 'view_eventlog'],
  Admin: ['approve', 'approve_discipline', 'approve_participant', 'confirm_payment', 'reject_payment', 'cancel', 'view_slip', 'view_detail', 'export', 'print', 'view_eventlog'],
  Finance: ['confirm_payment', 'reject_payment', 'cancel', 'view_slip', 'view_detail'],
  Vinai: ['approve_discipline', 'reject_discipline', 'view_slip', 'view_detail'],
  Tadtel: ['approve_participant', 'visitor_approval', 'view_slip', 'view_detail'],
  User: ['print']
};

// Sidebar menu visibility by role
const SIDEBAR_MENU = {
  Superadmin: ['home', 'reservations', 'reports', 'eventlog'],
  Admin: ['home', 'reservations', 'reports', 'eventlog'],
  Finance: ['reservations', 'reports'],
  Vinai: ['reservations', 'reports'],
  Tadtel: ['reservations', 'reports'],
  User: ['home']
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypZzOBaNeHVq3w0mzT0Pt-awA2MRUY0Ehjcef8JjFZHCfjaspMKPdmoqWGuCvZvBtWOw/exec';

// ===== STATE =====
let allRows = [];
let currentPage = 1;
let pageSize = 10;
let currentUser = null;

// ===== LOGIN =====
async function doLogin() {
  const username = document.getElementById('userInput').value;
  const pass = document.getElementById('passInput').value;
  
  if (!username || !pass) {
    document.getElementById('loginErr').textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าย';
    document.getElementById('loginErr').style.display = 'block';
    return;
  }

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', username: username, password: pass })
    });
    
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    
    if (data.status !== 'ok' || !data.user) {
      throw new Error(data.message || 'การเข้าสู่ระบบล้มเหลว');
    }
    
currentUser = {
       username: data.user.username,
       role: data.user.role,
       password: pass,
       displayName: data.user.displayName || data.user.username
     };
    
    // Clear error display
    document.getElementById('loginErr').style.display = 'none';
    
    // Show dashboard
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('dash').style.display = 'block';
    document.getElementById('topDate').textContent = new Date().toLocaleDateString('th-TH', {year:'numeric',month:'long',day:'numeric'});
    
    // Show user info in sidebar
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userName').textContent = currentUser.username;
document.getElementById('userInfo').style.display = 'block';
      
// Show/hide sidebar menu items based on role
       const visibleMenu = SIDEBAR_MENU[currentUser.role] || [];
       document.querySelectorAll('.sb-link').forEach(link => {
         const view = link.getAttribute('data-view');
         if (view && !visibleMenu.includes(view)) {
           link.style.display = 'none';
         } else {
           link.style.display = '';
         }
       });

       // Show/hide UI elements based on role (filter status, export/print buttons)
       const isAdminOrSuper = currentUser.role === 'Superadmin' || currentUser.role === 'Admin';
       const filterStatusEl = document.getElementById('filterStatus');
       const btnExport = document.getElementById('btnExport');
       const btnPrint = document.getElementById('btnPrint');
       const btnPrintVinai = document.getElementById('btnPrintVinai');
       if (filterStatusEl) filterStatusEl.style.display = isAdminOrSuper ? '' : 'none';
       if (btnExport) btnExport.style.display = isAdminOrSuper ? '' : 'none';
       if (btnPrint) btnPrint.style.display = isAdminOrSuper ? '' : 'none';
       if (btnPrintVinai) btnPrintVinai.style.display = isAdminOrSuper ? '' : 'none';
     
      switchView(visibleMenu.includes('home') ? 'home' : visibleMenu[0] || 'reservations');
     renderDashboardHome();
    loadData();
    
  } catch(e) {
    console.error('Login error:', e);
    document.getElementById('loginErr').textContent = e.message || 'การเข้าสู่ระบบล้มเหลว กรุณาตรวจสอบข้อมูล';
    document.getElementById('loginErr').style.display = 'block';
    document.getElementById('passInput').value = '';
    setTimeout(() => document.getElementById('loginErr').style.display = 'none', 3000);
  }
}

function hasPermission(action) {
  return currentUser && PERMISSIONS[currentUser.role] && PERMISSIONS[currentUser.role].includes(action);
}

function logEvent(action, details) {
  const event = {
    timestamp: new Date().toLocaleString('th-TH'),
    user: currentUser ? currentUser.username : 'unknown',
    displayName: currentUser ? currentUser.displayName : null,
    role: currentUser ? currentUser.role : 'unknown',
    action: action,
    details: details
  };
  allEvents.unshift(event);
  localStorage.setItem('eventlog', JSON.stringify(allEvents));
}

let allEvents = JSON.parse(localStorage.getItem('eventlog') || '[]');
function doLogout() {
  currentUser = null;
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('dash').style.display = 'none';
  document.getElementById('passInput').value = '';
  document.getElementById('userInput').value = '';
  document.getElementById('userInfo').style.display = 'none';
  // Reset sidebar menu visibility
  document.querySelectorAll('.sb-link').forEach(link => {
    link.style.display = '';
  });
  allRows = [];
}

// ===== LOAD DATA =====
async function loadData() {
  document.getElementById('tableBody').innerHTML = '<tr><td colspan="8" class="loading-state"><span class="spinner-sm"></span>กำลังโหลดข้อมูล...</td></tr>';
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getAll', username: currentUser.username, password: currentUser.password })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const data = JSON.parse(text);
    if (data.status !== 'ok') throw new Error(data.message || 'Unknown error');
    allRows = data.rows || [];
    document.getElementById('lastUpdated').textContent = 'อัพเดทล่าสุด: ' + new Date().toLocaleString('th-TH');
  } catch(e) {
    console.error('Load data error:', e);
    // Demo mode: use sample data if no Apps Script configured and DEMO_MODE is not explicitly disabled
    if (window.DEMO_MODE !== false && (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE')) {
      allRows = getDemoData();
      document.getElementById('lastUpdated').textContent = 'โหมด Demo (ยังไม่ได้เชื่อม Google Sheet)';
    } else {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="8" class="empty-state">❌ โหลดข้อมูลไม่สำเร็จ: ${e.message}</td></tr>`;
      return;
    }
  }
  updateStats();
  buildDateFilter();
  renderTable();
  logEvent('load_data', 'โหลดข้อมูลการจอง');
}

// ===== DEMO DATA =====
function getDemoData() {
  return [
    { ref:'VIS-11234', timestamp:'21/05/2568 09:12', visitorName:'สมชาย ใจดี', visitorPhone:'081-234-5678', visitorId:'1-1001-12345-67-8', relation:'บุตร / ธิดา', extraVisitorNames:'สมหญิง ใจดี|1-9999-11111-22-3|คู่สมรส;;น้องชาย ใจดี|1-9999-11111-22-4|พี่น้อง', visitorApproved:'yes', extraVisitorApproved:'yes;;no', prisonerName:'สมศักดิ์ มั่นคง', prisonerId:'20010001', wing:'แดน 3', visitDate:'28 พฤษภาคม 2568', visitorCount:3, total:3000, status:'รอตรวจสอบ', slipImage:'' },
    { ref:'VIS-22345', timestamp:'21/05/2568 10:30', visitorName:'สมหญิง รักดี', visitorPhone:'089-876-5432', visitorId:'1-2002-23456-78-9', relation:'คู่สมรส', prisonerName:'วิชัย สุขสม', prisonerId:'20020002', wing:'แดน 5', visitDate:'29 พฤษภาคม 2568', visitorCount:1, total:1000, status:'รอชำระเงิน', slipImage:'' },
    { ref:'VIS-33456', timestamp:'20/05/2568 14:45', visitorName:'นางมาลี หวานใจ', visitorPhone:'062-111-2222', visitorId:'1-3003-34567-89-0', relation:'บิดา / มารดา', prisonerName:'ประสิทธิ์ ดีมาก', prisonerId:'20030003', wing:'แดน 1', visitDate:'27 พฤษภาคม 2568', visitorCount:3, total:3000, status:'ชำระแล้ว', slipImage:'' },
    { ref:'VIS-44567', timestamp:'19/05/2568 11:00', visitorName:'ธนา สมบัติดี', visitorPhone:'095-333-4444', visitorId:'1-4004-45678-90-1', relation:'พี่น้อง', prisonerName:'ชัยวัฒน์ รุ่งเรือง', prisonerId:'20040004', wing:'แดน 2', visitDate:'26 พฤษภาคม 2568', visitorCount:2, total:2000, status:'ไม่อนุมัติ', slipImage:'' },
  ];
}

// ===== STATS =====
function updateStats() {
    const role = currentUser ? currentUser.role : null;
    const allowedStatuses = {
        Superadmin: null, // sees all
        Admin: null, // sees all
        Finance: ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'],
        Tadtel: ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบ'],
        Vinai: ['รอตรวจสอบวินัย', 'รอตรวจสอบ']
    };
    
    // Filter rows based on role (same logic as renderTable)
    let statsRows = allRows.filter(r => {
        if (!r.ref || String(r.ref).trim() === '') return false;
        if (allowedStatuses[role]) {
            const normalized = normalizeStatus(r.status);
            if (!allowedStatuses[role].includes(normalized)) return false;
        }
        return true;
    });
    
    document.getElementById('statTotal').textContent = statsRows.length;
    document.getElementById('statWait').textContent = statsRows.filter(r=>normalizeStatus(r.status)==='รอตรวจสอบวินัย').length;
    document.getElementById('statOk').textContent = statsRows.filter(r=>normalizeStatus(r.status)==='รอชำระเงิน'||normalizeStatus(r.status)==='ชำระแล้ว'||normalizeStatus(r.status)==='เสร็จสิ้น').length;
    document.getElementById('statReject').textContent = statsRows.filter(r=>normalizeStatus(r.status)==='ไม่อนุมัติ').length;
}

// ===== DATE FILTER =====
function buildDateFilter() {
  const dates = [...new Set(allRows.map(r=>r.visitDate))].sort();
  const sel = document.getElementById('filterDate');
  const cur = sel.value;
  sel.innerHTML = '<option value="">ทุกวัน</option>';
  dates.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    if (d === cur) o.selected = true;
    sel.appendChild(o);
  });
}

// ===== RENDER TABLE =====
function renderTable() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const fs = document.getElementById('filterStatus').value;
  const fd = document.getElementById('filterDate').value;
  const role = currentUser ? currentUser.role : null;
  
// Filter by role - each role sees only specific statuses
  const allowedStatuses = {
    Superadmin: null, // sees all
    Admin: null, // sees all
    Finance: ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'],
    Tadtel: ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบ'],
    Vinai: ['รอตรวจสอบวินัย', 'รอตรวจสอบ']
  };
  
    let rows = allRows.filter(r => {
        if (!r.ref || String(r.ref).trim() === '') return false;
        if (allowedStatuses[role]) {
            const normalized = normalizeStatus(r.status);
            if (!allowedStatuses[role].includes(normalized)) return false;
        }
        if (fs && normalizeStatus(r.status) !== fs) return false;
        if (fd && r.visitDate !== fd) return false;
        if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
        return true;
    });
  const totalFiltered = rows.length;
  document.getElementById('tableCount').textContent = totalFiltered + ' รายการ';

  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(startIdx, startIdx + pageSize);

if (!totalFiltered) {
     document.getElementById('tableBody').innerHTML = '<tr><td colspan="8" class="empty-state">ไม่พบข้อมูล</td></tr>';
     renderPagination(0, 0);
     return;
   }
document.getElementById('tableBody').innerHTML = pageRows.map((r, idx) => {
    const s = normalizeStatus(r.status);
    let badgeClass = 'badge-discipline-check';
    if (s === 'รอตรวจสอบวินัย') badgeClass = 'badge-discipline-check';
    else if (s === 'รอตรวจสอบผู้เข้าร่วม') badgeClass = 'badge-participant-check';
    else if (s === 'รอชำระเงิน') badgeClass = 'badge-payment-pending';
    else if (s === 'ชำระแล้ว') badgeClass = 'badge-paid';
    else if (s === 'เสร็จสิ้น') badgeClass = 'badge-completed';
    else if (s === 'ไม่อนุมัติ') badgeClass = 'badge-rejected';
    else if (s === 'ยกเลิก') badgeClass = 'badge-cancelled';

    const isDiscipline = s === 'รอตรวจสอบวินัย';
    const isParticipant = s === 'รอตรวจสอบผู้เข้าร่วม';
    const isPaymentPending = s === 'รอชำระเงิน';
    const isPaid = s === 'ชำระแล้ว';
    const isCompleted = s === 'เสร็จสิ้น';
    const isCancelled = s === 'ยกเลิก';
    const rowIdx = allRows.indexOf(r);

    // Status checkmarks - 3 steps of verification (updated workflow)
    const disciplineApproved = r.status !== 'รอตรวจสอบวินัย';
    const participantApproved = r.status === 'รอชำระเงิน' || r.status === 'ชำระแล้ว' || r.status === 'เสร็จสิ้น';
    const financeConfirmed = r.status === 'ชำระแล้ว' || r.status === 'เสร็จสิ้น';

const role = currentUser ? currentUser.role : 'User';
     const isAdminOrSuper = role === 'Superadmin' || role === 'Admin';
     
     // Permission helper for button visibility
     const canApproveDiscipline = isAdminOrSuper || hasPermission('approve_discipline');
     const canRejectDiscipline = isAdminOrSuper || hasPermission('reject_discipline');
     const canApproveParticipant = isAdminOrSuper || hasPermission('approve_participant');
     const canConfirmPayment = (role === 'Superadmin' || role === 'Admin' || hasPermission('confirm_payment'));
     const canRejectPayment = isAdminOrSuper || hasPermission('reject_payment');
     const canCancel = isAdminOrSuper || hasPermission('cancel');
     
return `<tr data-idx="${rowIdx}">
           <td data-label="เลขอ้างอิง"><b style="color:var(--blue);font-size:12px">${r.ref}</b></td>
<td data-label="ผู้เข้าร่วม">
              <div style="font-weight:600">${r.visitorName}</div>
              <div style="font-size:11px;color:var(--text2)">${r.visitorPhone||''}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);display:none" class="mobile-show-prisoner">
                <span style="font-weight:600;color:var(--text2)">👤 ผู้ต้องขัง:</span> ${r.prisonerName || ''} (#${r.prisonerId || ''})
              </div>
            </td>
           <td data-label="ผู้ต้องขัง" class="hide-mobile">
             <div style="font-weight:600">${r.prisonerName}</div>
             <div style="font-size:11px;color:var(--text2)">#${r.prisonerId}</div>
           </td>
           <td data-label="แดน">${r.wing||'—'}</td>
           <td data-label="จำนวน/ยอด">
             <div>${r.visitorCount} คน • ${(r.total||0).toLocaleString()} บ.</div>
           </td>
           <td data-label="สถานะ"><span class="badge ${badgeClass}">${r.status}</span></td>
           <td data-label="ตรวจสอบ">
             <div style="display:flex;gap:4px;align-items:center;justify-content:center">
               <span class="status-check ${disciplineApproved ? 'done' : 'pending'}" title="อนุมัติโดย Vinai (ตรวจสอบวินัย)">✓</span>
               <span class="status-check ${participantApproved ? 'done' : 'pending'}" title="อนุมัติโดย Tadtel (ผู้เข้าร่วม)">✓</span>
               <span class="status-check ${financeConfirmed ? 'done' : 'pending'}" title="ยืนยันโดย Finance (การเงิน)">✓</span>
             </div>
           </td>
<td data-label="จัดการ">
              <div class="action-btns">
                <button class="btn-slip" onclick="viewSlip(${rowIdx})">🧾 สลิป</button>
                <button class="btn-slip" style="background:var(--blue-light);color:var(--blue);border-color:var(--blue)" onclick="viewDetail(${rowIdx})">📋 รายละเอียด</button>
              </div>
              <div class="mobile-actions-expanded" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:${s === 'รอตรวจสอบวินัย' || s === 'รอตรวจสอบผู้เข้าร่วม' || s === 'รอชำระเงิน' || s === 'ชำระแล้ว' ? 'flex' : 'none'};flex-wrap:wrap;gap:6px">
                ${canConfirmPayment && (s === 'รอชำระเงิน' || s === 'ชำระแล้ว') ? `<button class="btn-confirm-pay" onclick="confirmPayment(${rowIdx})">${s === 'ชำระแล้ว' ? '✅ เสร็จสิ้น' : '💳 ยืนยันชำระเงิน'}</button>` : ''}
                ${canApproveDiscipline && s === 'รอตรวจสอบวินัย' ? `<button class="btn-approve" onclick="updateStatus(${rowIdx},'รอตรวจสอบผู้เข้าร่วม')">✓ อนุมัติวินัย</button>` : ''}
                ${canRejectDiscipline && s === 'รอตรวจสอบวินัย' ? `<button class="btn-reject" onclick="updateStatus(${rowIdx},'ไม่อนุมัติ')">✗ ปฏิเสธ</button>` : ''}
                ${canApproveParticipant && s === 'รอตรวจสอบผู้เข้าร่วม' ? `<button class="btn-approve" onclick="updateStatus(${rowIdx},'รอชำระเงิน')">✓ อนุมัติผู้เข้าร่วม</button>` : ''}
                ${canRejectPayment && (s === 'รอชำระเงิน' || s === 'ชำระแล้ว') ? `<button class="btn-reject-pay" onclick="updateStatus(${rowIdx},'รอชำระเงิน')">✗ ปฏิเสธการชำระ</button>` : ''}
                ${canCancel && !isCancelled && !['เสร็จสิ้น'].includes(s) ? `<button class="btn-cancel" onclick="cancelBooking(${rowIdx})">🚫 ยกเลิก</button>` : ''}
              </div>
           </td>
         </tr>`;
   }).join('');
   renderPagination(totalPages, totalFiltered);
}

function changePage(p) {
  if (p < 1) return;
  currentPage = p;
  renderTable();
}

function changePageSize(newSize) {
  pageSize = parseInt(newSize, 10) || 10;
  currentPage = 1;
  renderTable();
}

function resetToFirstPage() {
  currentPage = 1;
}

function renderPagination(totalPages, totalFiltered) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalFiltered);
  let html = `
    <div class="pagination-bar">
      <div class="page-size">
        แสดง 
        <select onchange="changePageSize(this.value)">
          <option value="5" ${pageSize===5?'selected':''}>5</option>
          <option value="10" ${pageSize===10?'selected':''}>10</option>
          <option value="20" ${pageSize===20?'selected':''}>20</option>
          <option value="50" ${pageSize===50?'selected':''}>50</option>
        </select>
        รายการ
      </div>
      <div class="page-info">หน้า ${currentPage} / ${totalPages} <span style="color:var(--text2)">(${startItem}-${endItem} จาก ${totalFiltered})</span></div>
      <div class="page-nav">
        <button onclick="changePage(${currentPage-1})" ${currentPage===1 ? 'disabled' : ''}>←</button>
  `;
  // page number buttons (compact)
  const maxButtons = 5;
  let startP = Math.max(1, currentPage - Math.floor(maxButtons/2));
  let endP = Math.min(totalPages, startP + maxButtons - 1);
  if (endP - startP + 1 < maxButtons) startP = Math.max(1, endP - maxButtons + 1);
  if (startP > 1) {
    html += `<button onclick="changePage(1)">1</button>`;
    if (startP > 2) html += `<span class="page-ellipsis">…</span>`;
  }
  for (let p = startP; p <= endP; p++) {
    if (p === currentPage) {
      html += `<span class="page-current">${p}</span>`;
    } else {
      html += `<button onclick="changePage(${p})">${p}</button>`;
    }
  }
  if (endP < totalPages) {
    if (endP < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
    html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
  }
  html += `
        <button onclick="changePage(${currentPage+1})" ${currentPage===totalPages ? 'disabled' : ''}>→</button>
      </div>
    </div>`;
  container.innerHTML = html;
}

function switchView(v) {
  document.querySelectorAll('.view').forEach(el => {
    el.style.display = (el.id === 'view-' + v) ? '' : 'none';
  });
  document.querySelectorAll('.sb-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('data-view') === v);
  });
  // Update bottom nav active state on mobile
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  bottomNavItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === v);
  });

  if (v === 'reservations') {
    renderTable();
  } else if (v === 'reports') {
    populateReportsDateFilter();
    renderReportsView();
  } else if (v === 'eventlog') {
    renderEventlog();
  } else if (v === 'addUser') {
    renderAddUser();
  }

  // Dashboard home view - only for Admin/Superadmin who have access
  if (v === 'home' && SIDEBAR_MENU[currentUser?.role]?.includes('home')) {
    renderDashboardHome();
  }
}

function renderEventlog() {
  const container = document.getElementById('eventlogBody');
  if (!container) return;
  
  // Limit to 100 entries max for display
  const displayEvents = allEvents.slice(0, 100);
  document.getElementById('eventlogCount').textContent = allEvents.length + ' รายการ' + (allEvents.length > 100 ? ' (แสดง 100 รายการล่าสุด)' : '');
  
  if (allEvents.length === 0) {
    container.innerHTML = '<tr><td colspan="5" class="empty-state">ยังไม่มีบันทึกการทำงาน</td></tr>';
    return;
  }
  
  container.innerHTML = displayEvents.map(e => `
    <tr>
      <td style="white-space:nowrap;font-size:12px;">${e.timestamp}</td>
      <td style="font-size:12px;">${e.user} <span style="color:var(--text2);">(${e.role})</span></td>
      <td style="font-size:12px;color:var(--text2);">${e.displayName || '-'}</td>
      <td style="font-size:12px;">${e.action}</td>
      <td style="font-size:12px;">${e.details}</td>
    </tr>
  `).join('');
}

function computeFinanceStats(rows) {
  let totalBooked = 0;
  let paid = 0;
  let unpaid = 0;
  let pendingReview = 0;
  let bookingCount = 0;

  (rows || []).forEach(r => {
    if (!r.ref || String(r.ref).trim() === '') return;
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') return;

    const amt = parseInt(r.total, 10) || 0;
    bookingCount++;
    totalBooked += amt;

    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') paid += amt;
    else if (s === 'รอชำระเงิน') unpaid += amt;
    else if (s === 'รอตรวจสอบ') pendingReview += amt;
  });

  return { totalBooked, paid, unpaid, pendingReview, bookingCount };
}

function getRowVisitDateKey(r) {
  let key = r.visitDateISO;
  if (!key && r.visitDate) {
    const ts = r.timestamp ? new Date(r.timestamp.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$2-$1')) : null;
    if (ts && !isNaN(ts)) key = ts.toISOString().slice(0, 10);
  }
  if (key && !/^\d{4}-\d{2}-\d{2}$/.test(String(key).trim())) {
    const parsed = new Date(key);
    if (!isNaN(parsed)) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      key = `${y}-${m}-${d}`;
    }
  }
  return key ? String(key).trim() : '';
}

function computeFinanceTimeSeries(rows) {
  const today = new Date();
  const days = [];
  const byDay = {};

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    byDay[key] = { booked: 0, paid: 0, unpaid: 0 };
  }

  (rows || []).forEach(r => {
    if (!r.ref || String(r.ref).trim() === '') return;
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') return;

    const key = getRowVisitDateKey(r);
    if (!key || !byDay[key]) return;

    const amt = parseInt(r.total, 10) || 0;
    byDay[key].booked += amt;
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') byDay[key].paid += amt;
    else if (s === 'รอชำระเงิน') byDay[key].unpaid += amt;
  });

  return {
    days,
    series: [
      { id: 'booked', label: 'ยอดจอง', color: '#0B2545', fillTop: 'rgba(11,37,69,0.22)', fillBottom: 'rgba(11,37,69,0.02)', values: days.map(d => byDay[d].booked) },
      { id: 'paid', label: 'ชำระแล้ว', color: '#2E5238', fillTop: 'rgba(46,82,56,0.2)', fillBottom: 'rgba(46,82,56,0.02)', values: days.map(d => byDay[d].paid) },
      { id: 'unpaid', label: 'ยังไม่ชำระ', color: '#C8922A', fillTop: 'rgba(200,146,42,0.25)', fillBottom: 'rgba(200,146,42,0.02)', values: days.map(d => byDay[d].unpaid) }
    ]
  };
}

let financeChartCache = [];

function formatBaht(n) {
  return (n || 0).toLocaleString('th-TH') + ' บาท';
}

function renderFinanceOverview() {
  const summaryEl = document.getElementById('financeSummary');
  const canvas = document.getElementById('financeChart');
  if (!summaryEl || !canvas) return;

  const stats = computeFinanceStats(allRows);
  const { totalBooked, paid, unpaid, pendingReview, bookingCount } = stats;

  summaryEl.innerHTML = `
    <div class="finance-kpi">
      <div class="finance-kpi-item total">
        <div class="finance-kpi-label">ยอดจองทั้งหมด</div>
        <div class="finance-kpi-val">${formatBaht(totalBooked)}</div>
        <div class="finance-kpi-sub">${bookingCount} รายการ</div>
      </div>
      <div class="finance-kpi-item paid">
        <div class="finance-kpi-label">ชำระแล้ว</div>
        <div class="finance-kpi-val">${formatBaht(paid)}</div>
        <div class="finance-kpi-sub">${totalBooked ? Math.round((paid / totalBooked) * 100) : 0}% ของยอดจอง</div>
      </div>
      <div class="finance-kpi-item unpaid">
        <div class="finance-kpi-label">ยังไม่ชำระ</div>
        <div class="finance-kpi-val">${formatBaht(unpaid)}</div>
        <div class="finance-kpi-sub">${totalBooked ? Math.round((unpaid / totalBooked) * 100) : 0}% ของยอดจอง</div>
      </div>
    </div>
    ${pendingReview > 0 ? `<div class="finance-pending-note">⏳ รอตรวจสอบ (ยังไม่ถึงขั้นชำระ): <strong>${formatBaht(pendingReview)}</strong></div>` : ''}
  `;

  const timeSeries = computeFinanceTimeSeries(allRows);
  drawFinanceLineChart(canvas, timeSeries);

  const legendEl = document.getElementById('financeLegend');
  if (legendEl) {
    legendEl.innerHTML = timeSeries.series.map(s => `
      <span class="finance-legend-item">
        <span class="finance-legend-line" style="background:${s.color}"></span>
        ${s.label}
      </span>
    `).join('');
  }
}

function formatChartBahtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function buildSmoothPoints(values, xAt, yAt, baselineY) {
  const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v), value: v }));
  if (pts.length < 2) return pts;
  return pts;
}

function traceSmoothLine(ctx, points) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }
}

function drawFinanceLineChart(canvas, timeSeries) {
  if (!canvas || !timeSeries) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const w = canvas.width = canvas.offsetWidth || 520;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);
  financeChartCache = [];

  const { days, series } = timeSeries;
  const allVals = series.flatMap(s => s.values);
  const maxVal = Math.max(1, ...allVals);
  const hasData = allVals.some(v => v > 0);

  const pad = { top: 24, right: 20, bottom: 32, left: 52 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const baseY = pad.top + chartH;

  if (!hasData) {
    ctx.fillStyle = '#6B7280';
    ctx.font = '13px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ยังไม่มียอดจองในช่วง 14 วันนี้', w / 2, h / 2);
    return;
  }

  const xAt = i => pad.left + (days.length <= 1 ? chartW / 2 : (i / (days.length - 1)) * chartW);
  const yAt = v => baseY - (v / maxVal) * chartH;

  // grid + y-axis labels
  ctx.strokeStyle = 'rgba(11,37,69,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillStyle = '#6B7280';
    ctx.font = '9px Sarabun, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatChartBahtShort(val), pad.left - 8, y + 3);
  }

  // x-axis labels (every other day on narrow screens)
  const step = days.length > 10 ? 2 : 1;
  days.forEach((day, i) => {
    if (i % step !== 0 && i !== days.length - 1) return;
    const x = xAt(i);
    const label = new Date(day + 'T12:00:00').toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
    ctx.fillStyle = '#3F4755';
    ctx.font = '9px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, h - 10);
  });

  // draw areas then lines (booked behind, unpaid in front)
  [...series].reverse().forEach(s => {
    const points = buildSmoothPoints(s.values, xAt, yAt, baseY);
    if (!points.length) return;

    const grad = ctx.createLinearGradient(0, pad.top, 0, baseY);
    grad.addColorStop(0, s.fillTop);
    grad.addColorStop(1, s.fillBottom);

    ctx.beginPath();
    traceSmoothLine(ctx, points);
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.lineTo(points[0].x, baseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    traceSmoothLine(ctx, points);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    points.forEach((p, i) => {
      financeChartCache.push({
        x: p.x - 8, y: p.y - 8, width: 16, height: 16,
        date: days[i],
        series: s.label,
        value: p.value,
        label: new Date(days[i] + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
      });
      if (p.value > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  });
}

// Hover tooltip for finance line chart (desktop) + tap support (mobile)
const financeCanvasEl = document.getElementById('financeChart');
if (financeCanvasEl) {
  financeCanvasEl.addEventListener('mousemove', (e) => {
    if (!financeChartCache.length) return;
    const rect = financeCanvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let found = null;
    let best = Infinity;
    for (const item of financeChartCache) {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const d = Math.hypot(mouseX - cx, mouseY - cy);
      if (d < 14 && d < best) { best = d; found = item; }
    }
    if (found) {
      financeCanvasEl.style.cursor = 'pointer';
      financeCanvasEl.title = `${found.label} · ${found.series}: ${found.value.toLocaleString('th-TH')} บาท`;
    } else {
      financeCanvasEl.style.cursor = 'default';
      financeCanvasEl.title = '';
    }
  });
  financeCanvasEl.addEventListener('mouseleave', () => {
    financeCanvasEl.style.cursor = 'default';
    financeCanvasEl.title = '';
  });
  // Tap for mobile
  financeCanvasEl.addEventListener('click', (e) => {
    if ('ontouchstart' in window) {
      showChartTooltip(financeCanvasEl, financeChartCache, financeCanvasEl.getBoundingClientRect(), e.clientX, e.clientY);
      setTimeout(hideChartTooltip, 2000);
    }
  });
}

function renderDashboardHome() {
  // Role‑based KPI visibility
  const role = currentUser && currentUser.role;
  const visible = {
    Superadmin: ['statTotal','statWait','statOk','statReject','statUniquePrisoners','statThisWeek','statThisMonth','statUniqueVisitors'],
    Admin: ['statTotal','statWait','statOk','statReject','statUniquePrisoners','statThisWeek','statThisMonth','statUniqueVisitors'],
    Vinai: ['statWait','statThisWeek'],
    Tadtel: ['statOk','statThisWeek'],
    Finance: ['statOk','statThisWeek','statUniqueVisitors']
  }[role]||[];
  // hide all KPI cards then show allowed
  ['statTotal','statWait','statOk','statReject','statUniquePrisoners','statThisWeek','statThisMonth','statUniqueVisitors'].forEach(id=>{
    const el=document.getElementById(id);
    if(el && el.parentElement && el.parentElement.parentElement){
      el.parentElement.parentElement.style.display = visible.includes(id)?'' : 'none';
    }
  });

  // Show pipeline for admin roles
  const pipeline = document.getElementById('approvalPipeline');
  if(pipeline && (role === 'Superadmin' || role === 'Admin')) {
    pipeline.style.display = 'block';
  } else if(pipeline) {
    pipeline.style.display = 'none';
  }

  const recentEl = document.getElementById('recentBookings');
  if (!recentEl) return;

  renderFinanceOverview();

  const total = allRows.length;

  // recent 5
  if (!total) {
    recentEl.innerHTML = '<div style="color:#888;font-size:12px">ยังไม่มีข้อมูล</div>';
    document.getElementById('statUniquePrisoners').textContent = '0';
    document.getElementById('statThisWeek').textContent = '0';
    document.getElementById('statThisMonth').textContent = '0';
    document.getElementById('statUniqueVisitors').textContent = '0';
    const chartEl = document.getElementById('trendChart');
    if (chartEl) chartEl.getContext && chartEl.getContext('2d').clearRect(0,0,chartEl.width,chartEl.height);
    return;
  }

let rhtml = '';
   allRows.slice(0, 5).forEach(r => {
     const idx = allRows.indexOf(r);
     const s = normalizeStatus(r.status);
     let bcls = 'badge-pending-review';
     if (s === 'รอชำระเงิน') bcls = 'badge-payment-pending';
     else if (s === 'ชำระแล้ว') bcls = 'badge-paid';
     else if (s === 'เสร็จสิ้น') bcls = 'badge-completed';
     else if (s === 'ไม่อนุมัติ') bcls = 'badge-rejected';
     else if (s === 'ยกเลิก') bcls = 'badge-cancelled';
     rhtml += `<div onclick="viewDetail(${idx});switchView('reservations')" style="padding:10px 2px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;flex-direction:column;gap:6px;">
       <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
         <b style="font-size:13px;color:var(--blue)">${r.ref}</b>
         <span class="badge ${bcls}" style="font-size:11px;padding:2px 8px;white-space:nowrap">${s}</span>
       </div>
       <div style="display:flex;flex-direction:column;gap:2px;font-size:12px">
         <span><strong style="color:var(--text2)">👤</strong> ${r.visitorName || ''}</span>
         <span><strong style="color:var(--text2)">🏢</strong> ${r.prisonerName || ''} (#${r.prisonerId || ''})</span>
         <span><strong style="color:var(--text2)">📅</strong> ${r.visitDate || ''} • <strong style="color:var(--blue)">${(r.total||0).toLocaleString()} บ.</strong></span>
       </div>
     </div>`;
   });
   
   const recentCountEl = document.getElementById('recentCount');
   if (recentCountEl) recentCountEl.textContent = '(' + allRows.length + ' รายการทั้งหมด)';
   
   recentEl.innerHTML = rhtml || '<div style="color:#888;font-size:13px;padding:12px;text-align:center">ยังไม่มีข้อมูล</div>';
   
// ===== Status Pipeline Visualization =====
    const statusOrder = ['รอตรวจสอบวินัย', 'รอตรวจสอบผู้เข้าร่วม', 'รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น', 'ไม่อนุมัติ', 'ยกเลิก'];
    const statusLabels = {'รอตรวจสอบวินัย':'วินัย','รอตรวจสอบผู้เข้าร่วม':'ผู้เข้าร่วม','รอชำระเงิน':'ชำระเงิน','ชำระแล้ว':'ชำระแล้ว','เสร็จสิ้น':'เสร็จ','ไม่อนุมัติ':'ปฏิเสธ','ยกเลิก':'ยกเลิก'};
    const statusCounts = {}; statusOrder.forEach(s => statusCounts[s] = 0);
    allRows.forEach(r => { const s = normalizeStatus(r.status); if (statusCounts[s]!==undefined) statusCounts[s]++; });
    const grandTotal = allRows.length;
    let pipelineHtml = '<div class="status-pipeline">';
    statusOrder.forEach(status => {
      const pct = grandTotal ? Math.round(statusCounts[status]/grandTotal*100) : 0;
      const colors = {'รอตรวจสอบวินัย':'var(--status-discipline)','รอตรวจสอบผู้เข้าร่วม':'var(--status-participant)','รอชำระเงิน':'var(--status-payment)','ชำระแล้ว':'var(--status-paid)','เสร็จสิ้น':'var(--status-completed)','ไม่อนุมัติ':'var(--status-rejected)','ยกเลิก':'var(--status-cancelled)'};
      pipelineHtml += `<div class="status-pipeline-item" style="flex:1;min-width:55px;padding:6px 4px;border-radius:8px;background:${colors[status]}22;border:1px solid ${colors[status]}33;text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">${statusLabels[status]}</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${statusCounts[status]}</div>
        <div style="font-size:9px;color:var(--text2)" class="status-pct">${pct}% ของทั้งหมด</div>
      </div>`;
    });
    pipelineHtml += '</div>';
    const pipelineEl = document.getElementById('statusPipeline');
    if (pipelineEl) pipelineEl.innerHTML = pipelineHtml;

  // ===== NEW: Additional professional metrics =====
  const uniquePrisoners = new Set();
  const uniqueVisitors = new Set();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  startOfWeek.setHours(0,0,0,0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let weekCount = 0, monthCount = 0;

  allRows.forEach(r => {
    if (r.prisonerId) uniquePrisoners.add(String(r.prisonerId).trim());
    const vid = r.visitorId || r.visitorName;
    if (vid) uniqueVisitors.add(String(vid).trim());

    // Prefer ISO date for accuracy
    let visitKey = r.visitDateISO;
    if (!visitKey && r.visitDate) {
      // Fallback: try to parse Thai date (rough) or use timestamp date
      const ts = r.timestamp ? new Date(r.timestamp.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$2-$1')) : null;
      if (ts && !isNaN(ts)) visitKey = ts.toISOString().slice(0,10);
    }
    if (visitKey) {
      const vDate = new Date(visitKey);
      if (!isNaN(vDate)) {
        if (vDate >= startOfWeek) weekCount++;
        if (vDate >= startOfMonth) monthCount++;
      }
    }
  });

  const uniqueP = document.getElementById('statUniquePrisoners');
  const thisWeekEl = document.getElementById('statThisWeek');
  const thisMonthEl = document.getElementById('statThisMonth');
  const uniqueV = document.getElementById('statUniqueVisitors');

  if (uniqueP) uniqueP.textContent = uniquePrisoners.size;
  if (thisWeekEl) thisWeekEl.textContent = weekCount;
  if (thisMonthEl) thisMonthEl.textContent = monthCount;
  if (uniqueV) uniqueV.textContent = uniqueVisitors.size;

  // Last updated in header
  const lastUpdatedEl = document.getElementById('overviewLastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  }

  // Trend Chart
  drawReservationTrendChart();
}

let trendDataCache = []; // for hover detection

function drawReservationTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Aggregate last 14 days
  const dateCounts = {};
  const today = new Date();
  const days = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    dateCounts[key] = 0;
  }

  allRows.forEach(r => {
    let key = r.visitDateISO;
    if (!key && r.visitDate) {
      const ts = r.timestamp ? new Date(r.timestamp.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$2-$1')) : null;
      if (ts && !isNaN(ts)) key = ts.toISOString().slice(0, 10);
    }
    if (key && dateCounts.hasOwnProperty(key)) dateCounts[key]++;
  });

  const values = days.map(d => dateCounts[d]);
  const maxVal = Math.max(1, ...values);

  const w = canvas.width = canvas.offsetWidth || 620;
  const h = canvas.height = 220;
  const paddingLeft = 32;
  const paddingBottom = 28;
  const paddingTop = 18;
  const chartW = w - paddingLeft - 8;
  const chartH = h - paddingBottom - paddingTop;
  const barGap = 5;
  const barW = Math.max(6, (chartW - (days.length - 1) * barGap) / days.length);

  trendDataCache = []; // reset for hover

  // Light grid lines
  ctx.strokeStyle = 'rgba(11,37,69,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = paddingTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartW, y);
    ctx.stroke();
  }

  // Bars + store positions for hover
  days.forEach((day, i) => {
    const val = values[i];
    const barH = Math.max(3, Math.round((val / maxVal) * chartH));
    const x = paddingLeft + i * (barW + barGap);
    const y = h - paddingBottom - barH;

    // Store data for tooltip
    trendDataCache.push({
      x, y, width: barW, height: barH,
      date: day,
      count: val,
      label: new Date(day).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
    });

    // Navy bar
    ctx.fillStyle = val > 0 ? '#0B2545' : '#E8E0D1';
    ctx.fillRect(x, y, barW, barH);

    // Gold top accent
    if (val > 0) {
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(x, y, barW, 2.5);
    }

    // Value label
    if (val > 0) {
      ctx.fillStyle = '#1C2433';
      ctx.font = 'bold 10px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, x + barW / 2, y - 5);
    }

    // Day label
    const labelDate = new Date(day);
    const label = labelDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
    ctx.fillStyle = '#3F4755';
    ctx.font = '9px Sarabun, sans-serif';
    ctx.fillText(label, x + barW / 2, h - 8);
  });

  // Y-axis max
  ctx.fillStyle = '#6B7280';
  ctx.font = '9px Sarabun, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(maxVal, paddingLeft - 6, paddingTop + 3);
}

// Simple hover tooltip for trend chart (desktop) + tap support (mobile)
const trendCanvas = document.getElementById('trendChart');
if (trendCanvas) {
  trendCanvas.addEventListener('mousemove', (e) => {
    if (!trendDataCache.length) return;
    const rect = trendCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let found = null;
    for (const item of trendDataCache) {
      if (mouseX >= item.x && mouseX <= item.x + item.width &&
          mouseY >= item.y && mouseY <= item.y + item.height) {
        found = item;
        break;
      }
    }
    if (found) {
      trendCanvas.style.cursor = 'pointer';
      trendCanvas.title = `${found.label} — ${found.count} รายการ`;
    } else {
      trendCanvas.style.cursor = 'default';
      trendCanvas.title = '';
    }
  });
  trendCanvas.addEventListener('mouseleave', () => {
    trendCanvas.style.cursor = 'default';
    trendCanvas.title = '';
  });
  // Tap for mobile
  trendCanvas.addEventListener('click', (e) => {
    if ('ontouchstart' in window) {
      showChartTooltip(trendCanvas, trendDataCache, trendCanvas.getBoundingClientRect(), e.clientX, e.clientY);
      setTimeout(hideChartTooltip, 2000);
    }
  });
}

// Redraw trend chart on window resize (when overview is visible)
window.addEventListener('resize', () => {
  const homeView = document.getElementById('view-home');
  if (homeView && homeView.style.display !== 'none' && document.getElementById('trendChart')) {
    clearTimeout(window._trendResizeTimer);
    window._trendResizeTimer = setTimeout(() => {
      if (typeof drawReservationTrendChart === 'function') drawReservationTrendChart();
      const financeCanvas = document.getElementById('financeChart');
      if (financeCanvas && typeof drawFinanceLineChart === 'function') {
        drawFinanceLineChart(financeCanvas, computeFinanceTimeSeries(allRows));
      }
    }, 120);
  }
});

// ===== MOBILE CHART INTERACTIONS - Touch/Tap Tooltips =====
let activeTooltip = null;
function showChartTooltip(canvas, data, rect, clientX, clientY) {
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;
  
  let found = null;
  let best = Infinity;
  
  for (const item of data) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const d = Math.hypot(mouseX - cx, mouseY - cy);
    if (d < 20 && d < best) { best = d; found = item; }
  }
  
  if (found) {
    if (activeTooltip) activeTooltip.remove();
    activeTooltip = document.createElement('div');
    activeTooltip.className = 'chart-tooltip';
    activeTooltip.style.cssText = `
      position: fixed; background: rgba(11,37,69,0.95); color: #fff;
      padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none;
      z-index: 9999; max-width: 200px; text-align: center;
    `;
    activeTooltip.textContent = `${found.label} · ${found.series}: ${found.value.toLocaleString('th-TH')} บาท`;
    activeTooltip.style.left = (clientX + 10) + 'px';
    activeTooltip.style.top = (clientY - 30) + 'px';
    document.body.appendChild(activeTooltip);
  }
}

function hideChartTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

// Setup touch/click handlers for both charts
function setupChartTouchInteractions() {
  const financeCanvas = document.getElementById('financeChart');
  if (financeCanvas) {
    financeCanvas.addEventListener('click', (e) => {
      showChartTooltip(financeCanvas, financeChartCache, financeCanvas.getBoundingClientRect(), e.clientX, e.clientY);
      setTimeout(hideChartTooltip, 2000);
    });
  }
  
  const trendCanvas = document.getElementById('trendChart');
  if (trendCanvas) {
    trendCanvas.addEventListener('click', (e) => {
      showChartTooltip(trendCanvas, trendDataCache, trendCanvas.getBoundingClientRect(), e.clientX, e.clientY);
      setTimeout(hideChartTooltip, 2000);
    });
  }
}

// ===== FILTER STATE MANAGEMENT =====
const filterState = {
  search: '',
  status: '',
  date: '',
  pageSize: 10
};

function updateFilterState(key, value) {
  filterState[key] = value;
  localStorage.setItem('adminFilterState', JSON.stringify(filterState));
}

function loadFilterState() {
  try {
    const saved = JSON.parse(localStorage.getItem('adminFilterState') || '{}');
    Object.assign(filterState, saved);
  } catch (e) {
    // Ignore parse errors
  }
}

function applySavedFilters() {
  const searchBox = document.getElementById('searchBox');
  const filterStatus = document.getElementById('filterStatus');
  const filterDate = document.getElementById('filterDate');
  
  if (searchBox && filterState.search) searchBox.value = filterState.search;
  if (filterStatus && filterState.status) filterStatus.value = filterState.status;
  if (filterDate && filterState.date) filterDate.value = filterState.date;
  
  const reportsSearchBox = document.getElementById('reportsSearchBox');
  if (reportsSearchBox && filterState.search) reportsSearchBox.value = filterState.search;
}

// ===== PULL TO REFRESH =====
let pullStartY = 0;
let pullRefreshEl = null;

function initPullToRefresh() {
  const main = document.querySelector('.main');
  if (!main) return;
  
  pullRefreshEl = document.getElementById('pullRefresh');
  if (!pullRefreshEl) return;
  
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  
  main.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });
  
  main.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    if (diff > 0 && diff < 80) {
      pullRefreshEl.style.top = (-50 + diff) + 'px';
      if (diff > 50) {
        pullRefreshEl.classList.add('visible');
      }
    }
  }, { passive: true });
  
  main.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const diff = currentY - startY;
    
    if (diff > 50) {
      pullRefreshEl.classList.remove('visible');
      pullRefreshEl.style.top = '-50px';
      resetToFirstPage();
      loadData();
    } else {
      pullRefreshEl.style.top = '-50px';
    }
  }, { passive: true });
}

// Initialize mobile features on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadFilterState();
  setupChartTouchInteractions();
  initPullToRefresh();
  
  const searchBox = document.getElementById('searchBox');
  if (searchBox) searchBox.addEventListener('input', (e) => updateFilterState('search', e.target.value));
  
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) filterStatus.addEventListener('change', (e) => updateFilterState('status', e.target.value));
  
  const filterDate = document.getElementById('filterDate');
  if (filterDate) filterDate.addEventListener('change', (e) => updateFilterState('date', e.target.value));
  
  // Apply saved filters after load
  applySavedFilters();
});

// ===== UPDATE STATUS =====
async function updateStatus(idx, newStatus) {
   const row = allRows[idx];
   const currentStatus = normalizeStatus(row.status);
   const role = currentUser ? currentUser.role : null;

   // Permission check based on source status
   if (role !== 'Superadmin' && role !== 'Admin') {
     if (currentStatus === 'รอตรวจสอบวินัย' && (newStatus === 'รอตรวจสอบผู้เข้าร่วม' || newStatus === 'ไม่อนุมัติ') && !hasPermission('approve_discipline')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }
     if (currentStatus === 'รอตรวจสอบผู้เข้าร่วม' && (newStatus === 'รอชำระเงิน' || newStatus === 'ไม่อนุมัติ') && !hasPermission('approve_participant')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }
     if ((currentStatus === 'รอชำระเงิน' || currentStatus === 'ชำระแล้ว' || currentStatus === 'เสร็จสิ้น') && newStatus === 'รอชำระเงิน' && !hasPermission('reject_payment')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }
   }

   if (!confirm(`ยืนยัน: ${newStatus} การจองของ "${row.visitorName}" ?`)) return;
  
  // Optimistic update
  const oldStatus = row.status;
  row.status = newStatus;
  
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateStatus', username: currentUser.username, password: currentUser.password, ref: row.ref, status: newStatus })
    });
    
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
    
    // Success
    logEvent('update_status', `เปลี่ยนสถานะ ${row.ref} เป็น ${newStatus}`);
    updateStats();
    renderTable();
    renderDashboardHome();
  } catch(e) {
    // Error - revert optimistic update
    console.error('Update status error:', e);
    row.status = oldStatus;
    alert(`ไม่สามารถเปลี่ยนสถานะได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
    updateStats();
    renderTable();
    renderDashboardHome();
  }
}

// ===== CONFIRM PAYMENT (ยืนยันการชำระเงิน) =====
async function confirmPayment(idx) {
     const row = allRows[idx];
     const s = normalizeStatus(row.status);
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('confirm_payment')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     const targetStatus = s === 'รอชำระเงิน' ? 'ชำระแล้ว' : 'เสร็จสิ้น';
     
     if (!confirm(`ยืนยันการชำระเงินสำหรับ "${row.visitorName}" (${row.ref}) ?\nสถานะจะเปลี่ยนเป็น "${targetStatus}"`)) return;
    
    const oldStatus = row.status;
    row.status = targetStatus;
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateStatus', username: currentUser.username, password: currentUser.password, ref: row.ref, status: targetStatus })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
        
        logEvent(s === 'รอชำระเงิน' ? 'confirm_payment_pending' : 'confirm_payment', `${s === 'รอชำระเงิน' ? 'ยืนยันชำระเงิน' : 'เสร็จสิ้น'} ${row.ref}`);
        updateStats();
        renderTable();
        renderDashboardHome();
    } catch(e) {
        console.error('Confirm payment error:', e);
        row.status = oldStatus;
        alert(`ไม่สามารถยืนยันการชำระเงินได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
    }
}

// ===== REJECT PAYMENT (ปฏิเสธการชำระเงิน) =====
async function rejectPayment(idx) {
     const row = allRows[idx];
     const s = normalizeStatus(row.status);
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('reject_payment')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     const reason = prompt(`ปฏิเสธการชำระเงินของ "${row.visitorName}" (${row.ref})\n\nเหตุผล (ถ้ามี):`, '');
     if (reason === null) return;
    
    const oldStatus = row.status;
    row.status = 'รอชำระเงิน';
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateStatus', username: currentUser.username, password: currentUser.password, ref: row.ref, status: 'รอชำระเงิน' })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
        
        logEvent('reject_payment', `ปฏิเสธการชำระเงิน ${row.ref} เหตุผล: ${reason}`);
        alert('ปฏิเสธการชำระเงินแล้ว (สถานะกลับไปเป็น "รอชำระเงิน")');
        updateStats();
        renderTable();
        renderDashboardHome();
    } catch(e) {
        console.error('Reject payment error:', e);
        row.status = oldStatus;
        alert(`ไม่สามารถปฏิเสธการชำระเงินได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
    }
}

// ===== CANCEL BOOKING =====
async function cancelBooking(idx) {
     const row = allRows[idx];
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('cancel')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     if (!confirm(`⚠️ ยืนยันการยกเลิกการจอง\n\nRef: ${row.ref}\nผู้เยี่ยม: ${row.visitorName}\nสถานะปัจจุบัน: ${row.status}\n\nการยกเลิกไม่สามารถกู้คืนได้`)) return;
    
    const oldStatus = row.status;
    row.status = 'ยกเลิก';
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'cancelBooking', username: currentUser.username, password: currentUser.password, ref: row.ref })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
    } catch(e) {
        console.error('Cancel booking error:', e);
        row.status = oldStatus;
        alert(`ไม่สามารถยกเลิกการจองได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
        return;
    }
    
    logEvent('cancel_booking', `ยกเลิกการจอง ${row.ref}`);
    updateStats();
    renderTable();
    renderDashboardHome();
}

/* ===== Per-visitor approval (update + recalc price + overwrite row) ===== */
async function updateVisitorApproval(idx, pidx, val) {
     const row = allRows[idx];
     if (!row) return;
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('visitor_approval')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     if (pidx === 0) {
        row.visitorApproved = val;
    } else {
        let arr = String(row.extraVisitorApproved || '').split(';;');
        const n = row.extraVisitorNames ? row.extraVisitorNames.split(';;').filter(x=>x.trim()).length : 0;
        while(arr.length < n) arr.push('');
        arr[pidx-1] = val;
        row.extraVisitorApproved = arr.join(';;');
    }
    
    // Optimistic update for visitor count and total
    const oldVisitorApproved = row.visitorApproved;
    const oldExtraVisitorApproved = row.extraVisitorApproved;
    const oldVisitorCount = row.visitorCount;
    const oldTotal = row.total;
    
    let approvedRel = ((row.visitorApproved || '') === 'yes' ? 1 : 0);
    if (row.extraVisitorApproved) {
        approvedRel += String(row.extraVisitorApproved).split(';;').filter(v => (v||'').trim().toLowerCase() === 'yes').length;
    }
    row.visitorCount = approvedRel;
    row.total = (approvedRel + 1) * 1000;
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'updateVisitorApproval', username: currentUser.username, password: currentUser.password, ref:row.ref, visitorApproved: row.visitorApproved||'', extraVisitorApproved: row.extraVisitorApproved||'', visitorCount: row.visitorCount, total: row.total }) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
        
        // Success
        logEvent('visitor_approval', `อัปเดตการอนุมัติ ${row.ref} ให้ ${val}`);
        viewDetail(idx);
        renderTable();
    } catch(e) {
        // Error - revert optimistic update
        console.error('Visitor approval error:', e);
        row.visitorApproved = oldVisitorApproved;
        row.extraVisitorApproved = oldExtraVisitorApproved;
        row.visitorCount = oldVisitorCount;
        row.total = oldTotal;
        alert(`ไม่สามารถอัปเดตการอนุมัติผู้เข้าร่วมได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
        viewDetail(idx);
        renderTable();
    }
}

/* ===== Visitor per-person approval helpers ===== */
function getApprLabel(v){ return v==='yes' ? '✅ เข้าได้' : v==='no' ? '❌ เข้าไม่ได้' : '⏳ รอตัดสิน'; }

// Normalize legacy statuses for consistent display across pages
function normalizeStatus(s) {
  const v = (s || '').toString().trim();
  // New workflow statuses (return as-is) - check first before legacy mapping
  if (['รอตรวจสอบวินัย', 'รอตรวจสอบผู้เข้าร่วม', 'รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น', 'ยกเลิก', 'ไม่อนุมัติ'].includes(v)) {
    return v;
  }
  // Legacy status mappings
  if (v === 'รอตรวจสอบ' || ['อนุมัติ', 'approved'].includes(v) || v.toLowerCase() === 'approved') return 'รอตรวจสอบวินัย';
  if (v.toLowerCase() === 'rejected') return 'ไม่อนุมัติ';
  if (v.toLowerCase() === 'paid') return 'ชำระแล้ว';
  if (v.toLowerCase() === 'done') return 'เสร็จสิ้น';
  return v || 'รอตรวจสอบวินัย';
}

function viewSlip(idx) {
  const row = allRows[idx];
  const modalBody = document.getElementById('modalBody');
  const slip = (row.slipImage || '').trim();

  const infoBox = `<div style="margin-top:10px;font-size:13px;color:var(--text2);padding:10px;background:var(--bg);border-radius:6px;">
    <b>${row.ref}</b> · ${row.visitorName}<br>
    ยอด: <b>${(row.total||0).toLocaleString()} บาท</b> · สถานะ: <b>${row.status}</b>
  </div>`;

  // ✅ ดึง fileId จาก Drive URL ทุกรูปแบบ (?id=, /d/, /open?id=)
  function extractDriveId(url) {
    const m = url.match(/(?:[?&]id=|\/d\/|\/open\?id=)([a-zA-Z0-9_-]{10,})/);
    return m ? m[1] : null;
  }

  if (slip && (slip.includes('drive.google.com') || slip.includes('googleusercontent.com'))) {
    const fileId = extractDriveId(slip);
    // ✅ ใช้ thumbnail URL สำหรับแสดง + uc?export=view เป็น fallback
    const thumbUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200` : slip;
    const openUrl  = fileId ? `https://drive.google.com/file/d/${fileId}/view`            : slip;

    modalBody.innerHTML = `
      <div style="text-align:center;padding:10px 10px 4px;">
        <img id="slipImg_${idx}" src="${thumbUrl}" alt="สลิปโอนเงิน"
          style="max-width:100%;max-height:480px;border-radius:8px;border:1px solid var(--border);display:block;margin:0 auto 4px;"
          onerror="document.getElementById('slipImgErr_${idx}').style.display='block';this.style.opacity='0.15';">
        <div id="slipImgErr_${idx}" style="display:none;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:8px;font-size:12px;color:#856404;margin-bottom:6px;">
          ⚠️ โหลดรูปภาพโดยตรงไม่สำเร็จ — กรุณากดปุ่มด้านล่างเพื่อเปิด
        </div>
        <a href="${openUrl}" target="_blank"
          style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:9px 20px;
            background:var(--blue);color:#fff;border-radius:8px;font-weight:600;
            text-decoration:none;font-size:13px;">
          🔗 เปิดสลิปใน Google Drive ↗
        </a>
      </div>${infoBox}`;

  } else if (slip && slip.startsWith('data:image')) {
    modalBody.innerHTML = `<img src="${slip}" alt="สลิป"
      style="max-width:100%;border-radius:8px;margin-bottom:10px;display:block;">${infoBox}`;

  } else if (slip && slip.startsWith('SLIP_UPLOADED:')) {
    modalBody.innerHTML = `<div style="padding:2rem;text-align:center;">
      <div style="font-size:32px;">✅</div>
      <div style="font-weight:600;margin-top:8px;">สลิปถูกอัปโหลดแล้ว</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">เวลาอัปโหลด: ${slip.replace('SLIP_UPLOADED:','')}</div>
    </div>${infoBox}`;

  } else if (slip && slip.startsWith('http')) {
    // URL ที่ไม่ใช่ Drive
    modalBody.innerHTML = `<div style="text-align:center;padding:10px;">
      <img src="${slip}" alt="สลิป"
        style="max-width:100%;border-radius:8px;display:block;margin:0 auto 8px;"
        onerror="this.style.opacity='0.1'">
      <a href="${slip}" target="_blank"
        style="display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:var(--blue);color:#fff;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px;">
        🔗 เปิดสลิปในแท็บใหม่ ↗
      </a>
    </div>${infoBox}`;

  } else if (row.status === 'ชำระแล้ว' || row.status === 'เสร็จสิ้น') {
    modalBody.innerHTML = `<div style="padding:2rem;text-align:center;">
      <div style="font-size:32px;">⏳</div>
      <div style="font-weight:600;margin-top:8px;">ยังไม่มีรูปสลิปในระบบ</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">ญาติอาจยังไม่ได้อัปโหลด หรือกำลังประมวลผล</div>
    </div>${infoBox}`;
  } else {
    modalBody.innerHTML = `<div style="padding:2rem;text-align:center;">
      <div style="font-size:32px;">📋</div>
      <div style="font-weight:600;margin-top:8px;">ยังไม่มีรูปสลิป</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px;">รอให้ญาติชำระเงินและอัปโหลดสลิป</div>
    </div>${infoBox}`;
  }
  document.getElementById('modalBg').classList.add('show');
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modalBg')) {
    document.getElementById('modalBg').classList.remove('show');
  }
}

// ===== DETAIL MODAL =====
function viewDetail(idx) {
  const r = allRows[idx];
  const s = r.status || '';
  let badgeClass = 'badge-pending-review';
  if (s === 'รอชำระเงิน') badgeClass = 'badge-payment-pending';
  else if (s === 'ชำระแล้ว') badgeClass = 'badge-paid';
  else if (s === 'เสร็จสิ้น') badgeClass = 'badge-completed';
  else if (s === 'ไม่อนุมัติ') badgeClass = 'badge-rejected';
  else if (s === 'ยกเลิก') badgeClass = 'badge-cancelled';
  else if (s === 'รอตรวจสอบ') badgeClass = 'badge-pending-review';
  else if (s === 'รอตรวจสอบวินัย') badgeClass = 'badge-discipline-check';
  else if (s === 'รอตรวจสอบผู้เข้าร่วม') badgeClass = 'badge-participant-check';

const va = r.visitorApproved || '';
   const role = currentUser ? currentUser.role : null;
   const isAdminOrSuper = role === 'Superadmin' || role === 'Admin';
   const canVisitorApproval = isAdminOrSuper || hasPermission('visitor_approval');
   const canApproveParticipant = isAdminOrSuper || hasPermission('approve_participant');

   const visitor1Html = `
     <div class="visitor-card">
       <div class="vc-num">👤 ผู้ร่วมกิจกรรมคนที่ 1 (ผู้จอง)</div>
       <div class="vc-name">${r.visitorName || '—'}</div>
       <div class="vc-info">บัตร: ${r.visitorId || '—'} · โทร: ${r.visitorPhone || '—'} · ความสัมพันธ์: ${r.relation || '—'}</div>
       <div class="vc-info">ศาสนา: ${r.religion || '—'} · แพ้อาหาร: ${r.allergy || '—'}</div>
        <div class="visitor-approval">
          <span class="lbl">สถานะ:</span>
          <span class="approval-badge ${va==='yes'?'yes':va==='no'?'no':'pending'}">${getApprLabel(va)}</span>
          ${canVisitorApproval ? `<button class="approval-btn yes" onclick="updateVisitorApproval(${idx},0,'yes')">✓</button>
          <button class="approval-btn no" onclick="updateVisitorApproval(${idx},0,'no')">✗</button>` : ''}
        </div>
     </div>`;

  let extraHtml = '';
  if (r.extraVisitorNames && r.extraVisitorNames.trim()) {
    const isNewFormat = r.extraVisitorNames.includes(';;') || r.extraVisitorNames.includes('|');
    let extras = [];
    if (isNewFormat) {
      extras = r.extraVisitorNames.split(';;').map(e => {
        const parts = e.split('|');
        return { 
          name: (parts[0]||'').trim(), 
          id: (parts[1]||'').trim(), 
          relation: (parts[2]||'').trim(),
          age: (parts[3]||'').trim()
        };
      }).filter(e => e.name);
    } else {
      extras = r.extraVisitorNames.split(/,(?![^(]*\))/).map(e => {
        const m = e.trim().match(/^(.+?)\s*\(([^,)]+?)(?:,\s*([^)]+))?\)$/);
        if (m) return { name: m[1].trim(), id: (m[2]||'').trim(), relation: (m[3]||'').trim(), age: '' };
        return { name: e.trim(), id: '', relation: '', age: '' };
      }).filter(e => e.name);
    }
extras.forEach((v, i) => {
       const infoParts = [];
       if (v.id) infoParts.push('บัตร: ' + v.id);
       if (v.relation) infoParts.push('ความสัมพันธ์: ' + v.relation);
       const ea = String(r.extraVisitorApproved || '').split(';;')[i] || '';
       extraHtml += `
         <div class="visitor-card">
           <div class="vc-num">👤 ผู้ร่วมกิจกรรมคนที่ ${i + 2}</div>
           <div class="vc-name">${v.name}</div>
           ${infoParts.length ? '<div class="vc-info">' + infoParts.join(' · ') + '</div>' : ''}
            <div class="visitor-approval">
              <span class="lbl">สถานะ:</span>
              <span class="approval-badge ${ea==='yes'?'yes':ea==='no'?'no':'pending'}">${getApprLabel(ea)}</span>
              ${canVisitorApproval ? `<button class="approval-btn yes" onclick="updateVisitorApproval(${idx},${i+1},'yes')">✓</button>
              <button class="approval-btn no" onclick="updateVisitorApproval(${idx},${i+1},'no')">✗</button>` : ''}
            </div>
         </div>`;
     });
  }

  const totalPersons = (parseInt(r.visitorCount) || 1) + 1;
  const total = parseInt(r.total) || totalPersons * 1000;

  document.getElementById('detailModalBody').innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:2px;">เลขอ้างอิง</div>
        <div style="font-size:20px;font-weight:700;color:var(--blue);letter-spacing:2px;">${r.ref || '—'}</div>
      </div>
      <span class="badge ${badgeClass}" style="font-size:13px;padding:6px 14px;">${s}</span>
    </div>

    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">ผู้ร่วมกิจกรรมทั้งหมด (${r.visitorCount || 1} คน)</div>
    ${visitor1Html}
    ${extraHtml}

    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-top:8px;">
      <div class="detail-row">
        <span class="dlbl">🔒 ผู้ต้องขัง</span>
        <span class="dval">${r.prisonerName || '—'} <span style="color:var(--text2);font-weight:400">(#${r.prisonerId || '—'})</span></span>
      </div>
      <div class="detail-row">
        <span class="dlbl">🏢 แดน</span>
        <span class="dval">${r.wing || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="dlbl">📅 วันที่เยี่ยม</span>
        <span class="dval">${r.visitDate || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="dlbl">👥 จำนวนรวม</span>
        <span class="dval">ญาติ ${r.visitorCount || '—'} + ผู้ต้องขัง 1 = ${totalPersons} คน</span>
      </div>
      <div class="detail-row">
        <span class="dlbl">💰 ค่าบริการอาหาร</span>
        <span class="dval" style="color:var(--blue);font-size:15px;">${total.toLocaleString()} บาท</span>
      </div>
<div class="detail-row">
         <span class="dlbl">🕐 จองเมื่อ</span>
         <span class="dval">${r.timestamp || '—'}</span>
       </div>
${canApproveParticipant && s === 'รอตรวจสอบผู้เข้าร่วม' ? `
         <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
           <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px;">
             <span style="font-size:12px;color:var(--text2);">อนุมัติทั้งหมด:</span>
             <button class="btn-approve" onclick="approveAllVisitorsInDetail(${idx})" style="font-size:12px;padding:6px 12px;">✓ อนุมัติทั้งหมดทันที</button>
           </div>
           <div style="display:flex;gap:8px;justify-content:flex-end">
             <button class="btn-approve" onclick="approveParticipantInDetail(${idx})" style="font-size:13px;padding:8px 16px;">✓ อนุมัติผู้เข้าร่วม (หลังตรวจสอบแต่ละคน)</button>
             <button class="btn-reject" onclick="rejectParticipantInDetail(${idx})" style="font-size:13px;padding:8px 16px;">✗ ปฏิเสธ</button>
           </div>
         </div>` : ''}
     </div>
   `;
  document.getElementById('detailModalBg').classList.add('show');
}

function closeDetailModal(e) {
  if (!e || e.target === document.getElementById('detailModalBg')) {
    document.getElementById('detailModalBg').classList.remove('show');
  }
}

async function approveParticipantInDetail(idx) {
     const row = allRows[idx];
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('approve_participant')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     if (!confirm(`อนุมัติผู้เข้าร่วมสำหรับ "${row.visitorName}" ใช่หรือไม่?`)) return;
    
    const oldStatus = row.status;
    row.status = 'รอชำระเงิน';
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateStatus', username: currentUser.username, password: currentUser.password, ref: row.ref, status: 'รอชำระเงิน' })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
        
        logEvent('approve_participant', `อนุมัติผู้เข้าร่วม ${row.ref}`);
        updateStats();
        renderTable();
        renderDashboardHome();
        closeDetailModal();
    } catch(e) {
        console.error('Approve participant error:', e);
        row.status = oldStatus;
        alert(`ไม่สามารถอนุมัติผู้เข้าร่วมได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
        updateStats();
        renderTable();
        renderDashboardHome();
        closeDetailModal();
    }
}

async function rejectParticipantInDetail(idx) {
     const row = allRows[idx];
     const role = currentUser ? currentUser.role : null;

     // Permission check
     if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('approve_participant')) {
       alert('คุณไม่มีสิทธิ์ทำรายการนี้');
       return;
     }

     if (!confirm(`ปฏิเสธผู้เข้าร่วมสำหรับ "${row.visitorName}" ให้หรือไม่?`)) return;
     
     const oldStatus = row.status;
     row.status = 'ไม่อนุมัติ';
     
     try {
         const resp = await fetch(APPS_SCRIPT_URL, {
             method: 'POST',
             redirect: 'follow',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' },
             body: JSON.stringify({ action: 'updateStatus', username: currentUser.username, password: currentUser.password, ref: row.ref, status: 'ไม่อนุมัติ' })
         });
         if (!resp.ok) throw new Error('HTTP ' + resp.status);
         const data = await resp.json();
         if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');
         
         // Success
logEvent('reject_participant', `ปฏิเสธผู้เข้าร่วม ${row.ref}`);
          updateStats();
          renderTable();
          renderDashboardHome();
          closeDetailModal();
      } catch(e) {
          // Error - revert optimistic update
          console.error('Reject participant error:', e);
          row.status = oldStatus;
          alert(`ไม่สามารถปฏิเสธผู้เข้าร่วมได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
          updateStats();
          renderTable();
          renderDashboardHome();
          closeDetailModal();
      }
}

/* ===== Approve all visitors at once (Tadtel flow) ===== */
async function approveAllVisitorsInDetail(idx) {
  const row = allRows[idx];
  const role = currentUser ? currentUser.role : null;

  // Permission check
  if (role !== 'Superadmin' && role !== 'Admin' && !hasPermission('approve_participant')) {
    alert('คุณไม่มีสิทธิ์ทำรายการนี้');
    return;
  }

  if (!confirm(`อนุมัติผู้เข้าร่วมทุกคนสำหรับ "${row.visitorName}" ใช่หรือไม่? (จะอนุมัติทันทีโดยไม่ต้องตรวจสอบแต่ละคน)`)) return;

  // Approve all visitors automatically
  const oldStatus = row.status;
  const oldVisitorApproved = row.visitorApproved;
  const oldExtraVisitorApproved = row.extraVisitorApproved;

  row.visitorApproved = 'yes';
  const extras = parseExtraVisitors(row);
  if (extras.length > 0) {
    row.extraVisitorApproved = extras.map(() => 'yes').join(';;');
  } else {
    row.extraVisitorApproved = '';
  }

  // Calculate visitor count and total
  const approvedRel = 1 + (row.extraVisitorApproved ? row.extraVisitorApproved.split(';;').filter(v => (v||'').trim().toLowerCase() === 'yes').length : 0);
  row.visitorCount = approvedRel;
  row.total = (approvedRel + 1) * 1000;

  // Now approve to next status
  const newStatus = 'รอชำระเงิน';

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateVisitorApproval',
        username: currentUser.username,
        password: currentUser.password,
        ref: row.ref,
        visitorApproved: row.visitorApproved,
        extraVisitorApproved: row.extraVisitorApproved,
        visitorCount: row.visitorCount,
        total: row.total
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Unauthorized');

    // Then update status
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateStatus',
        username: currentUser.username,
        password: currentUser.password,
        ref: row.ref,
        status: newStatus
      })
    });

    logEvent('approve_all_visitors', `อนุมัติผู้เข้าร่วมทั้งหมด ${row.ref}`);
    updateStats();
    renderTable();
    renderDashboardHome();
    closeDetailModal();
  } catch(e) {
    console.error('Approve all visitors error:', e);
    row.status = oldStatus;
    row.visitorApproved = oldVisitorApproved;
    row.extraVisitorApproved = oldExtraVisitorApproved;
    alert(`ไม่สามารถอนุมัติผู้เข้าร่วมทั้งหมดได้: ${e.message || 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'}`);
    updateStats();
    renderTable();
    closeDetailModal();
  }
}

// ===== EXPORT FILTERED DATA AS CSV =====

// ===== EXPORT FILTERED DATA AS CSV =====
function exportFilteredCSV() {
    // Removed permission check - everyone can export
    const q = document.getElementById('searchBox').value.toLowerCase();
    const fs = document.getElementById('filterStatus').value;
    const fd = document.getElementById('filterDate').value;

   const filtered = allRows.filter(r => {
     if (!r.ref || String(r.ref).trim() === '') return false;
     if (fs && normalizeStatus(r.status) !== fs) return false;
     if (fd && r.visitDate !== fd) return false;
     if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
     return true;
   });

  if (!filtered.length) {
    alert('ไม่มีข้อมูลตาม filter ที่เลือก');
    return;
  }

  const headers = ['ref','timestamp','visitorName','visitorPhone','visitorId','relation','prisonerName','prisonerId','wing','visitDate','visitorCount','total','status','extraVisitorNames','visitorApproved','extraVisitorApproved'];
  let csvContent = headers.join(',') + '\r\n';

  filtered.forEach(r => {
    const row = headers.map(h => {
      let val = r[h] != null ? String(r[h]) : '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    });
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel Thai
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CC_Cafe_Reservations_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  logEvent('export_csv', 'ส่งออกข้อมูลเป็น CSV');
}

// ===== HELPER: Parse extra visitors (same logic as detail view) =====
function parseExtraVisitors(row) {
  if (!row || !row.extraVisitorNames || !String(row.extraVisitorNames).trim()) return [];
  const str = String(row.extraVisitorNames);
  const isNew = str.includes(';;') || str.includes('|');
  if (isNew) {
    return str.split(';;').map(e => {
      const p = e.split('|');
      return { 
        name: (p[0]||'').trim(), 
        id: (p[1]||'').trim(), 
        relation: (p[2]||'').trim(),
        age: (p[3]||'').trim()
      };
    }).filter(e => e.name);
  } else {
    return str.split(/,(?![^(]*\))/).map(e => {
      const m = e.trim().match(/^(.+?)\s*\(([^,)]+?)(?:,\s*([^)]+))?\)$/);
      if (m) return { name: m[1].trim(), id: (m[2]||'').trim(), relation: (m[3]||'').trim(), age: '' };
      return { name: e.trim(), id: '', relation: '', age: '' };
    }).filter(e => e.name);
  }
}

// ===== HELPER: Compute department report data (same logic as booking page) =====
function computeDeptReportData(row) {
  const n = parseInt(row.visitorCount) || 1;
  const totalPersons = n + 1;

  const extras = parseExtraVisitors(row); // now includes .age

  let adults = 1; // main visitor
  let kids5_8 = 0, kidsUnder5 = 0;
  const kids5_8Names = [], kidsUnder5Names = [];

  extras.forEach((v, vi) => {
    const ea = String(row.extraVisitorApproved || '').split(';;')[vi] || '';
    if (ea === 'no') return;
    
    if (v.relation === 'บุตร / ธิดา') {
      const a = parseInt(v.age, 10);
      if (!isNaN(a)) {
        if (a < 5) {
          kidsUnder5++;
          kidsUnder5Names.push(v.name);
        } else if (a <= 8) {
          kids5_8++;
          kids5_8Names.push(v.name);
        } else {
          adults++;
        }
      } else {
        adults++;
      }
    } else {
      adults++;
    }
  });

  const total = parseInt(row.total) || totalPersons * 1000;

  return {
    n,
    totalPersons,
    adults,
    kids5_8,
    kidsUnder5,
    kids5_8Names,
    kidsUnder5Names,
    total,
    prisonerName: row.prisonerName || '—',
    prisonerId: row.prisonerId || '—',
    wing: row.wing || '—',
    visitDate: row.visitDate || '—',
    visitorName: row.visitorName || '—',
    visitorPhone: row.visitorPhone || '—',
    relation: row.relation || '—',
    ref: row.ref || '—'
  };
}

// ===== HELPER: Get current filtered & sorted rows (respects UI filters) =====
function getCurrentFilteredSorted() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const fs = document.getElementById('filterStatus').value;
  const fd = document.getElementById('filterDate').value;

   let filtered = allRows.filter(r => {
     if (!r.ref || String(r.ref).trim() === '') return false;
     if (fs && normalizeStatus(r.status) !== fs) return false;
     if (fd && r.visitDate !== fd) return false;
     if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
     return true;
   });

  if (!filtered.length) return [];
  return [...filtered].sort((a, b) => String(a.ref || '').localeCompare(String(b.ref || '')));
}

// ===== PRINT REPORT: Sorted by Ref No. (respects current filters) =====
function printReport() {
  const filtered = getCurrentFilteredSorted();
  if (!filtered.length) {
    alert('ไม่มีข้อมูลตาม filter ที่เลือก');
    return;
  }

  const now = new Date().toLocaleString('th-TH');

  // Calculate grand totals
  let totalVisitors = 0;
  let totalPrice = 0;
  filtered.forEach(r => {
    const cnt = parseInt(r.visitorCount) || 1;
    totalVisitors += cnt;
    totalPrice += parseInt(r.total) || 0;
  });
  const totalPrisoners = filtered.length;
  const totalPeople = totalVisitors + totalPrisoners;

  let html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายงานการจัดโต๊ะ - CC Cafe</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
  body { font-family: 'Sarabun', system-ui, sans-serif; padding: 20px 24px; margin:0; color:#000; background:#fff; line-height:1.5; font-size:14px; }
  h1 { font-size:22px; margin:0 0 4px; font-weight:700; text-align:center; color: #0B2545; }
  h2 { font-size:16px; margin:0 0 2px; font-weight:700; color: #1C2433; }
  .meta { font-size:12px; color:#555; text-align:center; margin-bottom:20px; }
  
  /* Table/Ref Block */
  .table-block { 
    margin-bottom:20px; 
    page-break-inside: avoid; 
    border: 2px solid #0B2545; 
    border-radius: 8px; 
    overflow: hidden;
    background:#fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  }
  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #0B2545;
    color: #fff;
  }
  .table-num {
    font-size: 15px;
    font-weight: 700;
    background: #D4AF37;
    color: #1C2433;
    padding: 4px 14px;
    border-radius: 4px;
  }
  .table-ref {
    font-size: 14px;
    font-weight: 600;
    margin-left: 10px;
  }
  .table-date {
    font-size: 12px;
    opacity: 0.9;
  }
  
  /* Content sections */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 14px;
  }
  .info-section {
    border: 1.5px solid #ddd;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fafafa;
  }
  .info-section.prisoner {
    background: #f0f7f0;
    border-color: #166534;
  }
  .info-section.visitor {
    background: #f0f4ff;
    border-color: #0B2545;
  }
  .section-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 6px;
    color: #0B2545;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .info-section.prisoner .section-title {
    color: #166534;
  }
  .info-line {
    margin: 3px 0;
    font-size: 13px;
    line-height: 1.4;
  }
  .info-line b {
    font-weight: 600;
    color: #1C2433;
  }
  
  /* Extra visitors */
  .extra-section {
    grid-column: 1 / -1;
    background: #fff8e7;
    border: 1.5px solid #f5c542;
    border-radius: 6px;
    padding: 10px 12px;
  }
  .extra-title {
    font-weight: 700;
    font-size: 13px;
    color: #92400e;
    margin-bottom: 6px;
  }
  .extra-item {
    font-size: 13px;
    padding: 2px 0;
    padding-left: 12px;
    position: relative;
  }
  .extra-item::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #D4AF37;
    font-weight: bold;
  }
  
  /* Footer info */
  .table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f8f9fa;
    border-top: 1.5px solid #ddd;
  }
  .visit-date-info {
    font-size: 13px;
    color: #555;
  }
  .visit-date-info b {
    color: #0B2545;
    font-size: 15px;
  }
  .people-count {
    background: #D4AF37;
    color: #1C2433;
    padding: 6px 16px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    min-width: 120px;
  }
  .people-count .label {
    font-size: 11px;
    font-weight: 500;
    display: block;
  }
  .people-count .number {
    font-size: 18px;
    font-weight: 800;
  }
  
  /* Grand Summary */
  .grand-summary { 
    margin-top: 36px; 
    page-break-before: always;
    padding: 24px;
  }
  .grand-box {
    border: 3px solid #0B2545;
    border-radius: 10px;
    padding: 24px 32px;
    background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
    max-width: 500px;
    margin: 0 auto;
  }
  .grand-title {
    font-size: 18px;
    font-weight: 800;
    color: #0B2545;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #0B2545;
  }
  .grand-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px 0;
    font-size: 15px;
  }
  .grand-item .g-label {
    color: #555;
    font-weight: 500;
  }
  .grand-item .g-number {
    font-weight: 800;
    font-size: 20px;
    color: #0B2545;
  }
  .grand-total {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 3px solid #D4AF37;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .grand-total .g-label {
    font-size: 16px;
    font-weight: 600;
    color: #1C2433;
  }
  .grand-total .g-number {
    font-size: 26px;
    font-weight: 900;
    color: #D4AF37;
  }
  
  .footer-note {
    text-align: center;
    font-size: 11px;
    color: #888;
    margin-top: 20px;
  }
  
  /* Page footer - fixed at bottom of page */
  body {
    margin-bottom: 16mm;
  }
  .page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 12mm;
    border-top: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    background: #fff;
  }
  .table-block {
    margin-bottom: 16mm;
  }
  
  @media print {
    @page { size: A4; margin: 10mm 8mm; }
    body { padding: 4mm 6mm; font-size: 11px; line-height: 1.4; }
    h1 { font-size: 16px; margin-bottom: 2px; }
    h2 { font-size: 13px; }
    .meta { font-size: 10px; margin-bottom: 8px; }
    .table-block { 
      padding: 0;
      margin-bottom: 3mm;
      border-width: 1.5px;
    }
    .table-header {
      padding: 6px 10px;
    }
    .table-num {
      padding: 3px 10px;
      font-size: 12px;
    }
    .table-ref {
      font-size: 12px;
    }
    .table-date {
      font-size: 10px;
    }
    .content-grid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 8px 10px;
    }
    .info-section {
      padding: 6px 8px;
    }
    .section-title {
      font-size: 11px;
      margin-bottom: 4px;
    }
    .info-line {
      margin: 2px 0;
      font-size: 11px;
    }
    .info-line b {
      font-size: 11px;
    }
    .extra-section {
      padding: 6px 8px;
    }
    .extra-title {
      font-size: 11px;
      margin-bottom: 4px;
    }
    .extra-item {
      font-size: 11px;
      padding: 1px 0;
      padding-left: 10px;
    }
    .table-footer {
      padding: 6px 10px;
    }
    .visit-date-info {
      font-size: 11px;
    }
    .visit-date-info b {
      font-size: 13px;
    }
    .people-count {
      padding: 4px 12px;
      font-size: 13px;
    }
    .people-count .label {
      font-size: 9px;
    }
    .people-count .number {
      font-size: 15px;
    }
    .grand-summary {
      margin-top: 6mm;
      padding: 12px;
    }
    .grand-box {
      padding: 16px 20px;
    }
    .grand-title {
      font-size: 14px;
      margin-bottom: 10px;
      padding-bottom: 6px;
    }
    .grand-item {
      margin: 6px 0;
      font-size: 12px;
    }
    .grand-item .g-number {
      font-size: 16px;
    }
    .grand-total {
      margin-top: 10px;
      padding-top: 10px;
    }
    .grand-total .g-label {
      font-size: 13px;
    }
    .grand-total .g-number {
      font-size: 20px;
    }
    
    /* Page footer */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 12mm;
      border-top: 1px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #666;
      background: #fff;
    }
    .table-block {
      margin-bottom: 16mm;
    }
  }
</style></head><body>`;

  html += `<h1>🪑 รายงานการจัดโต๊ะ</h1>`;
  html += `<h2>ร้าน Chance & Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง</h2>`;
  html += '<div class="meta">พิมพ์เมื่อ ' + now + ' · ผู้ปริ้น: ' + (currentUser?.displayName || currentUser?.username || 'ไม่ระบุ') + ' · เรียงตามเลขที่อ้างอิง · จำนวน ' + filtered.length + ' โต๊ะ</div>';

  filtered.forEach((r, i) => {
    const extras = parseExtraVisitors(r);
    const visitorCount = parseInt(r.visitorCount) || 1;
    const totalPeopleThisTable = visitorCount + 1; // visitors + prisoner

    html += `<div class="table-block">`;
    
    // Header
    html += `<div class="table-header">`;
    html += `<div style="display:flex;align-items:center;">`;
    html += `<span class="table-num">โต๊ะ ${i+1}</span>`;
    html += `<span class="table-ref">${r.ref || '—'}</span>`;
    html += `</div>`;
    html += `<span class="table-date">📅 ${r.visitDate || '—'}</span>`;
    html += `</div>`;

    // Content Grid
    html += `<div class="content-grid">`;
    
    // Left: Prisoner Info
    html += `<div class="info-section prisoner">`;
    html += `<div class="section-title">🔒 ผู้ต้องขัง</div>`;
    html += `<div class="info-line">ชื่อ: <b>น.ช. ${r.prisonerName || '—'}</b></div>`;
    html += `<div class="info-line">เลขประจำตัว: <b>${r.prisonerId || '—'}</b></div>`;
    html += `<div class="info-line">แดน: <b>${r.wing || '—'}</b></div>`;
    html += `</div>`;

    // Right: Main Visitor Info
    html += `<div class="info-section visitor">`;
    html += `<div class="section-title">👤 ผู้เยี่ยมหลัก</div>`;
    html += `<div class="info-line"><b>${r.visitorName || '—'}</b></div>`;
    html += `<div class="info-line">โทร: ${r.visitorPhone || '—'}</div>`;
    html += `<div class="info-line">ความสัมพันธ์: ${r.relation || '—'}</div>`;
    html += `<div class="info-line">ศาสนา: ${r.religion || '—'}</div>`;
    html += `<div class="info-line">แพ้อาหาร: ${r.allergy || 'ไม่มี'}</div>`;
    html += `</div>`;

    // Extra visitors (full width)
    if (extras.length > 0) {
      const approvedExtras = extras.filter((e, ei) => {
        const ea = String(r.extraVisitorApproved || '').split(';;')[ei] || '';
        return ea !== 'no';
      });
      if (approvedExtras.length > 0) {
        html += `<div class="extra-section">`;
        html += `<div class="extra-title">👥 ผู้เยี่ยมเพิ่มเติม (${approvedExtras.length} คน)</div>`;
        approvedExtras.forEach((e) => {
          html += `<div class="extra-item">${e.name || '—'} · ${e.relation || '—'}${e.id ? ' · บัตร ' + e.id : ''}</div>`;
        });
        html += `</div>`;
      }
    }

    html += `</div>`; // End content-grid

    // Footer with date and people count
    html += `<div class="table-footer">`;
    html += `<div class="visit-date-info">วันที่เยี่ยม: <b>${r.visitDate || '—'}</b></div>`;
    html += `<div class="people-count">`;
    html += `<span class="label">จำนวนคน</span>`;
    html += `<span class="number">${totalPeopleThisTable} คน</span>`;
    html += `</div>`;
    html += `</div>`;

    html += `</div>`; // End table-block
  });

  // ========== GRAND TOTAL SUMMARY ==========
  html += `<div class="grand-summary">`;
  html += `<div class="grand-box">`;
  html += `<div class="grand-title">📋 สรุปยอดรวมทั้งหมด</div>`;
  
  html += `<div class="grand-item">`;
  html += `<span class="g-label">จำนวนโต๊ะ</span>`;
  html += `<span class="g-number">${filtered.length} โต๊ะ</span>`;
  html += `</div>`;
  
  html += `<div class="grand-item">`;
  html += `<span class="g-label">จำนวนผู้เยี่ยม</span>`;
  html += `<span class="g-number">${totalVisitors} คน</span>`;
  html += `</div>`;
  
  html += `<div class="grand-item">`;
  html += `<span class="g-label">จำนวนผู้ต้องขัง</span>`;
  html += `<span class="g-number">${totalPrisoners} คน</span>`;
  html += `</div>`;
  
  html += `<div class="grand-item">`;
  html += `<span class="g-label">ยอดเงินรวม</span>`;
  html += `<span class="g-number">${totalPrice.toLocaleString('th-TH')} บาท</span>`;
  html += `</div>`;

  html += `<div class="grand-total">`;
  html += `<span class="g-label">รวมคนทั้งหมด</span>`;
  html += `<span class="g-number">${totalPeople} คน</span>`;
  html += `</div>`;
  
html += `</div>`;
   html += `<div class="footer-note">พิมพ์จากระบบ CC Cafe Reservation · ทัณฑสถานบำบัดพิเศษกลาง · ${now}</div>`;
   html += `</div>`;
   
   // Page footer for print
   const printerName = currentUser?.displayName || currentUser?.username || 'ไม่ระบุ';
   html += `<div class="page-footer">ผู้ปริ้น: ${printerName} · พิมพ์เมื่อ ${now}</div>`;
   
   html += `</body></html>`;

  const w = window.open('', '_blank', 'width=1200,height=850');
  if (!w) {
    alert('กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์รายงาน');
    return;
  }
  w.document.write(html);
  w.document.close();

  setTimeout(() => {
    try { w.focus(); w.print(); } catch(e){}
  }, 650);
}

// ===== PRINT PRISONER LIST FOR วินัย CHECK (only name, ID, Wing) =====
function printPrisonerVinaiList() {
  const filtered = getCurrentFilteredSorted();
  if (!filtered.length) {
    alert('ไม่มีข้อมูลตาม filter ที่เลือก');
    return;
  }

  const now = new Date().toLocaleString('th-TH');
  const filterDate = document.getElementById('filterDate').value || 'ทุกวัน';

  let html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายชื่อผู้ต้องขัง - ตรวจสอบวินัย ${filterDate}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  body { font-family: 'Sarabun', system-ui, sans-serif; padding: 16px 20px; margin:0; color:#000; background:#fff; font-size:15px; }
  h1 { font-size:18px; margin:0 0 2px; font-weight:700; text-align:center; line-height:1.3; }
  .meta { font-size:11px; color:#333; text-align:center; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th, td { border:1.5px solid #000; padding:6px 8px; text-align:left; }
  th { background:#f1f5f9; font-weight:700; font-size:13px; }
  td { font-size:14px; }
  .num { width:42px; text-align:center; }
  .note { margin-top:12px; font-size:11px; color:#444; text-align:center; font-style:italic; }
  @media print {
    @page { size: A4; margin: 8mm; }
    body { padding: 4mm 6mm; font-size:12px; }
    h1 { font-size:15px; }
    th, td { padding:4px 6px; font-size:12px; }
    .note { display:none; }
  }
</style></head><body>`;

  html += `<h1>รายชื่อผู้ต้องขัง - ตรวจสอบวินัย<br><span style="font-size:14px; font-weight:500;">วันที่ ${filterDate}</span></h1>`;
  html += `<div class="meta">ทัณฑสถานบำบัดพิเศษกลาง • พิมพ์เมื่อ ${now}</div>`;

  html += `<table>`;
  html += `<thead><tr>`;
  html += `<th class="num">ลำดับ</th>`;
  html += `<th>ชื่อผู้ต้องขัง</th>`;
  html += `<th>เลขประจำตัว</th>`;
  html += `<th>แดนที่อยู่</th>`;
  html += `</tr></thead><tbody>`;

  filtered.forEach((r, i) => {
    html += `<tr>`;
    html += `<td class="num">${i+1}</td>`;
    html += `<td><b>${r.prisonerName || '-'}</b></td>`;
    html += `<td>${r.prisonerId || '-'}</td>`;
    html += `<td>${r.wing || '-'}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;

html += `<div class="note">สำหรับใช้ตรวจสอบวินัย • ข้อมูลจากระบบการจอง CC Cafe</div>`;
   const printerName = currentUser?.displayName || currentUser?.username || 'ไม่ระบุ';
   html += `<div style="margin-top:8mm;font-size:10px;color:#666;text-align:center;">ผู้ปริ้น: ${printerName} · พิมพ์เมื่อ ${now}</div>`;
   html += `</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์');
    return;
  }
  w.document.write(html);
  w.document.close();

  setTimeout(() => {
    try { w.focus(); w.print(); } catch(e){}
  }, 400);
}

// ===== DAILY AGGREGATED DEPARTMENT REPORTS (respects current filters) =====
function renderDailyDeptReports() {
  const container = document.getElementById('dailyReportsContent');
  const section = document.getElementById('dailyReportsSection');
  if (!container || !section) return;

  const filtered = getCurrentFilteredSorted();
  if (filtered.length === 0) {
    section.style.display = 'none';
    return;
  }

  const byDate = {};
  filtered.forEach(r => {
    const dateKey = r.visitDate || r.visitDateISO || 'ไม่ระบุวันที่';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(r);
  });

  let html = '';

  Object.keys(byDate).sort().forEach(date => {
    const rows = byDate[date];

    let totalAdults = 0, totalKids5_8 = 0, totalKidsUnder5 = 0;
    let prisoners = [];
    let totalTables = rows.length;

    rows.forEach(r => {
      const d = computeDeptReportData(r);
      totalAdults += d.adults;
      totalKids5_8 += d.kids5_8;
      totalKidsUnder5 += d.kidsUnder5;

      if (r.prisonerName && !prisoners.includes(r.prisonerName)) {
        prisoners.push(r.prisonerName);
      }
    });

    const totalRelatives = rows.reduce((sum, r) => sum + (parseInt(r.visitorCount) || 1), 0);
    const totalPeople = totalRelatives + rows.length;

    html += `
      <div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:var(--bg2);">
        <div style="font-weight:700; font-size:14px; margin-bottom:6px; color:var(--blue);">${date}</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap:8px; font-size:12px;">
          <div style="background:#fff5f5; border:1px solid #c62828; border-radius:6px; padding:8px;">
            <strong style="color:#c62828">🚨 ส่วนทัณฑ์</strong><br>
            <div style="margin-top:4px;">${prisoners.length} คน</div>
            <div style="font-size:11px; color:#666; margin-top:2px;">${prisoners.slice(0,3).join(', ')}${prisoners.length > 3 ? ' ...' : ''}</div>
          </div>
          <div style="background:#fff8f0; border:1px solid #ff9800; border-radius:6px; padding:8px;">
            <strong style="color:#e65100">🪑 โต๊ะ</strong><br>
            <div style="margin-top:4px; font-weight:700;">${totalTables} โต๊ะ</div>
            <div style="font-size:11px;">รวม ${totalPeople} คน</div>
          </div>
          <div style="background:#f0fff0; border:1px solid #2e7d32; border-radius:6px; padding:8px;">
            <strong style="color:#1b5e20">🍽️ ครัว</strong><br>
            ผู้ใหญ่: <strong>${totalAdults}</strong><br>
            เด็ก 5-8: <strong>${totalKids5_8}</strong><br>
            ต่ำกว่า 5: <strong>${totalKidsUnder5}</strong>
          </div>
          <div style="background:#fffdf5; border:1px solid #c8922a; border-radius:6px; padding:8px;">
            <strong style="color:#8d6e00">🍰 เบเกอรี่</strong><br>
            ผู้ใหญ่: <strong>${totalAdults}</strong><br>
            เด็ก 5-8: <strong>${totalKids5_8}</strong><br>
            ต่ำกว่า 5: <strong>${totalKidsUnder5}</strong>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  section.style.display = 'block';
}

function renderAddUser() {
    // Removed permission check - everyone can access user management
    document.getElementById('view-addUser').style.display = '';
    fetchRolesList();
    loadAddUserTable();
}

function fetchRolesList() {
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getRoles', username: currentUser.username, password: currentUser.password })
  })
  .then(resp => resp.json())
  .then(data => {
    if (data.status === 'ok') {
      populateRoleDropdown(data.roles);
    } else {
      console.error('Failed to fetch roles:', data.message);
    }
  })
  .catch(err => {
    console.error('Error fetching roles:', err);
  });
}

function populateRoleDropdown(roles) {
  const select = document.getElementById('addUserRole');
  select.innerHTML = '<option value="">เลือกบทบาท</option>';
  roles.forEach(role => {
    const option = document.createElement('option');
    option.value = role.roleName;
    option.textContent = role.roleName;
    select.appendChild(option);
  });
}

function createAddUser() {
  const username = document.getElementById('addUserUsername').value.trim();
  const password = document.getElementById('addUserPassword').value;
  const confirmPassword = document.getElementById('addUserConfirmPassword').value;
  const role = document.getElementById('addUserRole').value;

  if (!username || !password || !confirmPassword || !role) {
    alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }
  if (password !== confirmPassword) {
    alert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    return;
  }
  if (password.length < 6) {
    alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    return;
  }

  // Call createUser action
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'createUser', username: username, password: password, role: role, pass: currentUser.password })
  })
  .then(resp => resp.json())
  .then(data => {
    if (data.status === 'ok') {
      alert('สร้างผู้ใช้สำเร็จ');
      // Clear form
      document.getElementById('addUserUsername').value = '';
      document.getElementById('addUserPassword').value = '';
      document.getElementById('addUserConfirmPassword').value = '';
      document.getElementById('addUserRole').value = '';
      // Reload the table
      loadAddUserTable();
    } else {
      alert('เกิดข้อผิดพลาด: ' + data.message);
    }
  })
  .catch(err => {
    console.error('Error creating user:', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  });
}

function loadAddUserTable() {
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getUsers', username: currentUser.username, password: currentUser.password })
  })
  .then(resp => resp.json())
  .then(data => {
    if (data.status === 'ok') {
      renderAddUserTable(data.users);
    } else {
      console.error('Failed to fetch users:', data.message);
    }
  })
  .catch(err => {
    console.error('Error fetching users:', err);
  });
}

function renderAddUserTable(users) {
  const tbody = document.getElementById('addUserTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ยังไม่มีผู้ใช้ในระบบ</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    // Determine if user can be edited/deleted? For simplicity, we just show.
    return `<tr>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>${u.displayName || '-'}</td>
      <td>
        <button class="btn-refresh" onclick="editUser('${u.username}')">แก้ไข</button>
        <button class="btn-refresh" onclick="deleteUser('${u.username}')">ลบ</button>
      </td>
    </tr>`;
  }).join('');
}

// Placeholder functions for edit/delete (optional)
function editUser(username) {
  alert('ฟังก์ชันแก้ไขผู้ใช้ยังไม่ได้ทำการติดตั้ง');
}
function deleteUser(username) {
  if (confirm(`คุณต้องการลบผู้ใช้ "${username}" จริงหรือไม่?`)) {
    alert('ฟังก์ชันลบผู้ใช้ยังไม่ได้ทำการติดตั้ง');
  }
}

function printDailyDeptReports() {
  const filtered = getCurrentFilteredSorted();
  if (filtered.length === 0) {
    alert('ไม่มีข้อมูลตาม filter ที่เลือก');
    return;
  }

  const byDate = {};
  filtered.forEach(r => {
    const dateKey = r.visitDate || r.visitDateISO || 'ไม่ระบุวันที่';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(r);
  });

  const now = new Date().toLocaleString('th-TH');
  const printerName = currentUser?.displayName || currentUser?.username || 'ไม่ระบุ';

  let html = `
    <html><head><meta charset="UTF-8">
    <title>รายงานประจำวัน - แยกตามฝ่าย</title>
    <style>
      body { font-family: 'Sarabun', sans-serif; font-size:13px; padding:20px; }
      h1 { text-align:center; margin-bottom:4px; }
      .date-block { border:2px solid #333; margin-bottom:20px; padding:12px; page-break-inside:avoid; }
      .date-title { font-size:16px; font-weight:700; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:8px; }
      .dept { margin-bottom:8px; padding:6px; border:1px solid #aaa; border-radius:4px; }
      .dept strong { display:block; margin-bottom:4px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th, td { border:1px solid #999; padding:4px 6px; text-align:left; font-size:12px; }
      .footer-note { text-align:center; font-size:11px; color:#888; margin-top:20px; }
    </style>
    </head><body>
    <h1>รายงานสรุปประจำวัน (แยกตามฝ่าย)</h1>
    <div style="text-align:center; margin-bottom:8px; color:#555;">ผู้ปริ้น: ${printerName} • พิมพ์เมื่อ ${now}</div>
  `;
  
  Object.keys(byDate).sort().forEach(date => {
    const rows = byDate[date];
    let totalAdults=0, total5_8=0, totalUnder5=0, prisoners=[];

    rows.forEach(r => {
      const d = computeDeptReportData(r);
      totalAdults += d.adults;
      total5_8 += d.kids5_8;
      totalUnder5 += d.kidsUnder5;
      if (r.prisonerName && !prisoners.includes(r.prisonerName)) prisoners.push(r.prisonerName);
    });

    const totalTables = rows.length;
    const totalRel = rows.reduce((s,r) => s + (parseInt(r.visitorCount)||1), 0);

    html += `<div class="date-block">`;
    html += `<div class="date-title">${date}</div>`;

// ส่วนทัณฑ์
     html += `<div class="dept" style="border-color:#c62828;">`;
     html += `<strong style="color:#c62828">🚨 ส่วนทัณฑ์ (เบิกตัวผู้ต้องขัง)</strong>`;
     html += `จำนวน: <strong>${prisoners.length} คน</strong><br>`;
     html += prisoners.map((p, i) => `${i+1}. ${p}`).join('<br>');
     html += `</div>`;

    // Table
    html += `<div class="dept" style="border-color:#ff9800;">`;
    html += `<strong style="color:#e65100">🪑 การจัดโต๊ะ</strong>`;
    html += `จำนวนโต๊ะ: <strong>${totalTables} โต๊ะ</strong><br>`;
    html += `รวมผู้เข้าร่วม: ${totalRel + totalTables} คน (ญาติ ${totalRel} + ผู้ต้องขัง ${totalTables})<br>`;
    html += `<strong>รวมทั้งหมด: ${totalRel + totalTables} คน</strong>`;
    html += `</div>`;

    // Kitchen + Bakery (combined)
    const combinedAdults = totalAdults + totalTables;
    html += `<div class="dept" style="border-color:#2e7d32;">`;
    html += `<strong style="color:#1b5e20">🍽️🍰 ครัว + เบเกอรี่ (รวม)</strong>`;
    html += `ผู้ใหญ่ (รวมผู้ต้องขัง): <strong>${combinedAdults}</strong> คน &nbsp;&nbsp;`;
    html += `เด็ก 5-8 ปี: <strong>${total5_8}</strong> คน &nbsp;&nbsp;`;
    html += `ต่ำกว่า 5 ปี: <strong>${totalUnder5}</strong> คน`;
    html += `</div>`;

    html += `</div>`;
  });

  html += `</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

// ===== Helper: Get filtered rows for the Reports page (independent filters) =====
function getReportsFilteredRows() {
  const searchEl = document.getElementById('reportsSearchBox');
  const statusEl = document.getElementById('reportsFilterStatus');
  const dateEl   = document.getElementById('reportsFilterDate');

  const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const fs = statusEl ? statusEl.value : '';
  const fd = dateEl ? dateEl.value : '';

  return allRows.filter(r => {
    if (fs && normalizeStatus(r.status) !== fs) return false;
    if (fd && (r.visitDate !== fd && r.visitDateISO !== fd)) return false;

    if (q) {
      const text = [
        r.ref, r.visitorName, r.visitorPhone, r.visitorId,
        r.prisonerName, r.prisonerId, r.wing, r.extraVisitorNames
      ].join(' ').toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

// ===== Populate date options for Reports page =====
function populateReportsDateFilter() {
  const select = document.getElementById('reportsFilterDate');
  if (!select || !allRows.length) return;

  const dates = [...new Set(allRows.map(r => r.visitDate || r.visitDateISO).filter(Boolean))].sort();

  // Keep current selection if possible
  const current = select.value;
  select.innerHTML = '<option value="">ทุกวัน</option>';
  dates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  if (dates.includes(current)) select.value = current;
}

// ===== NEW: Dedicated Reports View (each department as its own section/page) =====
function renderReportsView() {
  const container = document.getElementById('reportsContent');
  if (!container) return;

  // Use the reports page's own filters
  const filtered = getReportsFilteredRows();

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--text2);">ไม่พบข้อมูลตามเงื่อนไขที่กรอง<br>ลองเปลี่ยน Filter ด้านบน</div>`;
    return;
  }

  // Group by date
  const byDate = {};
  filtered.forEach(r => {
    const key = r.visitDate || r.visitDateISO || 'ไม่ระบุวันที่';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });

  let html = '';

  Object.keys(byDate).sort().forEach(date => {
    const rows = byDate[date];

    // Aggregate data
    let totalAdults = 0, total5_8 = 0, totalUnder5 = 0;
    const prisonerList = []; // for ส่วนทัณฑ์

    rows.forEach(r => {
      const d = computeDeptReportData(r);
      totalAdults += d.adults;
      total5_8 += d.kids5_8;
      totalUnder5 += d.kidsUnder5;

      if (r.prisonerName && !prisonerList.some(p => p.id === r.prisonerId)) {
        prisonerList.push({
          name: r.prisonerName,
          id: r.prisonerId,
          wing: r.wing || '-'
        });
      }
    });

    const totalTables = rows.length;
    const totalRelatives = rows.reduce((sum, r) => sum + (parseInt(r.visitorCount) || 1), 0);

    html += `<div style="margin-bottom:32px; border:1px solid var(--border); border-radius:10px; padding:16px; background:var(--bg2);">`;
    html += `<div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--blue);">📅 ${date}</div>`;

    // ========== 1. ส่วนทัณฑ์ (Prisoner) - TABLE FORMAT ==========
    html += `<div style="margin-bottom:20px;">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
    html += `<strong style="font-size:14px;color:#c62828;">🚨 รายงานส่วนทัณฑ์ (เบิกตัวผู้ต้องขัง)</strong>`;
    html += `<button onclick="printSingleReport('disciplinary', '${date}')" style="font-size:11px;padding:4px 10px;background:#c62828;color:white;border:none;border-radius:4px;cursor:pointer;">🖨️ พิมพ์</button>`;
    html += `</div>`;

    if (prisonerList.length > 0) {
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
      html += `<thead><tr style="background:#f8f8f8;">`;
      html += `<th style="border:1px solid #ddd;padding:6px;text-align:left;">ชื่อ-นามสกุล</th>`;
      html += `<th style="border:1px solid #ddd;padding:6px;text-align:left;">เลขประจำตัวผู้ต้องขัง</th>`;
      html += `<th style="border:1px solid #ddd;padding:6px;text-align:left;">แดน</th>`;
      html += `</tr></thead><tbody>`;

      prisonerList.forEach(p => {
        html += `<tr>`;
        html += `<td style="border:1px solid #ddd;padding:6px;"><strong>น.ช. ${p.name}</strong></td>`;
        html += `<td style="border:1px solid #ddd;padding:6px;">${p.id}</td>`;
        html += `<td style="border:1px solid #ddd;padding:6px;">${p.wing}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table>`;
    } else {
      html += `<div style="color:#888;font-size:12px;">ไม่มีข้อมูลผู้ต้องขัง</div>`;
    }
    html += `</div>`;

    // ========== ครัว + เบเกอรี่ (รวมเป็นอันเดียว) ==========
    const combinedAdults = totalAdults + totalTables; // ผู้ใหญ่ + ผู้ต้องขัง (นับเป็นผู้ใหญ่)

    html += `<div style="margin-bottom:20px;">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
    html += `<strong style="font-size:14px;color:#1b5e20;">🍽️🍰 ครัว + เบเกอรี่ (เตรียมอาหารและของหวาน)</strong>`;
    html += `<button onclick="printSingleReport('kitchen-bakery', '${date}')" style="font-size:11px;padding:4px 10px;background:#2e7d32;color:white;border:none;border-radius:4px;cursor:pointer;">🖨️ พิมพ์</button>`;
    html += `</div>`;
    html += `<div style="font-size:13px;line-height:1.6;">`;
    html += `จำนวนโต๊ะ: <strong>${totalTables}</strong> โต๊ะ &nbsp;&nbsp;`;
    html += `รวมผู้เข้าร่วม: <strong>${totalRelatives + totalTables}</strong> คน (ญาติ ${totalRelatives} + ผู้ต้องขัง ${totalTables})<br>`;
    html += `ผู้ใหญ่ (รวมผู้ต้องขัง): <strong>${combinedAdults}</strong> คน &nbsp;|&nbsp; `;
    html += `เด็ก 5-8 ปี: <strong>${total5_8}</strong> คน &nbsp;|&nbsp; `;
    html += `ต่ำกว่า 5 ปี: <strong>${totalUnder5}</strong> คน`;
    html += `</div>`;
    html += `</div>`;

    // ========== 4. การจัดโต๊ะ (รายละเอียดต่อโต๊ะ) ==========
    html += `<div>`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
    html += `<strong style="font-size:14px;color:#e65100;">🪑 รายงานการจัดโต๊ะ</strong>`;
    html += `<button onclick="printSingleReport('table', '${date}')" style="font-size:11px;padding:4px 10px;background:#ff9800;color:white;border:none;border-radius:4px;cursor:pointer;">🖨️ พิมพ์</button>`;
    html += `</div>`;

    // Calculate grand total for the day (reuse variable declared earlier in this date block)
    const totalPeopleForDay = totalRelatives + rows.length; // +1 prisoner per table

    // Detailed per-table list
    html += `<div style="font-size:12px; line-height:1.6;">`;
    rows.forEach((r, i) => {
      const tableNo = i + 1;
      const ref = r.ref || '—';
      const prisoner = r.prisonerName ? `น.ช. ${r.prisonerName}` : '—';

      // Get main visitor + extras
      let visitors = [r.visitorName || '—'];
      const extras = parseExtraVisitors(r);
      extras.forEach(ex => {
        if (ex.name) visitors.push(ex.name);
      });

      const totalPeople = (parseInt(r.visitorCount) || 1) + 1; // relatives + prisoner

      html += `
        <div style="border:1px solid #ddd; border-radius:4px; padding:8px; margin-bottom:6px; background:#fff;">
          <strong>โต๊ะ ${tableNo} = ${ref}</strong><br>
          ผู้ต้องขัง: <strong>${prisoner}</strong><br>
          ผู้เยี่ยม: ${visitors.join(' + ')}<br>
          <span style="color:#555;">จำนวนทั้งหมด: <strong>${totalPeople} คน</strong> (รวมผู้ต้องขัง)</span>
        </div>
      `;
    });

    // Grand total line at the bottom
    html += `
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #ccc; font-weight:600; color:#e65100;">
        รวมทั้งหมด: <strong>${totalPeopleForDay} คน</strong> จาก ${rows.length} โต๊ะ
      </div>
    `;
    html += `</div>`;
    html += `</div>`;

    html += `</div>`; // close date block
  });

  container.innerHTML = html;
}

// Helper to print individual department report for a specific date
function printSingleReport(type, date) {
  // Prefer Reports page filters (reports search/status/date) when available,
  // otherwise fall back to the main Reservations page filters.
  let baseRows = [];
  try {
    const hasReportsFilters =
      document.getElementById('reportsSearchBox') ||
      document.getElementById('reportsFilterStatus') ||
      document.getElementById('reportsFilterDate');
    baseRows = hasReportsFilters ? getReportsFilteredRows() : getCurrentFilteredSorted();
  } catch (e) {
    baseRows = getCurrentFilteredSorted();
  }

  // Keep a stable order for printing (Ref No. ascending)
  const filtered = (baseRows || [])
    .filter(r => (r.visitDate || r.visitDateISO) === date)
    .sort((a, b) => String(a.ref || '').localeCompare(String(b.ref || '')));
  if (filtered.length === 0) return;

  let content = '';
  const now = new Date().toLocaleString('th-TH');

  if (type === 'disciplinary') {
    const prisoners = [];
    filtered.forEach(r => {
      if (r.prisonerName && !prisoners.some(p => p.id === r.prisonerId)) {
        prisoners.push({ name: r.prisonerName, id: r.prisonerId, wing: r.wing });
      }
    });

    content = `<h2>🚨 รายงานส่วนทัณฑ์ (เบิกตัวผู้ต้องขัง) - ${date}</h2>`;
    content += `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:13px;">`;
    content += `<tr style="background:#f0f0f0;"><th>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>เลขประจำตัวผู้ต้องขัง</th><th>แดน</th></tr>`;
    prisoners.forEach((p, i) => {
      content += `<tr><td>${i+1}</td><td><strong>น.ช. ${p.name}</strong></td><td>${p.id}</td><td>${p.wing || '-'}</td></tr>`;
    });
    content += `</table>`;
  } 
  else if (type === 'kitchen' || type === 'bakery' || type === 'kitchen-bakery') {
    let visitorAdults = 0, k5 = 0, ku = 0;
    let tables = filtered.length;
    let relatives = filtered.reduce((s,r) => s + (parseInt(r.visitorCount)||1), 0);

    filtered.forEach(r => {
      const d = computeDeptReportData(r);
      visitorAdults += d.adults; k5 += d.kids5_8; ku += d.kidsUnder5;
    });

    const combinedAdults = visitorAdults + tables; // รวมผู้ต้องขังเป็นผู้ใหญ่

    const reportBody = `
      <div style="border:2px solid #333; padding:12px; margin-bottom:8px; font-size:13px;">
        <strong style="font-size:15px;">🍽️🍰 ครัว + เบเกอรี่ — วันที่ ${date}</strong><br><br>
        จำนวนโต๊ะ: <strong>${tables} โต๊ะ</strong><br>
        รวมผู้เข้าร่วม: <strong>${relatives + tables} คน</strong> (ญาติ ${relatives} + ผู้ต้องขัง ${tables})<br><br>
        <strong>ผู้ใหญ่ (รวมผู้ต้องขัง):</strong> ${combinedAdults} คน<br>
        <strong>เด็ก 5-8 ปี:</strong> ${k5} คน<br>
        <strong>ต่ำกว่า 5 ปี:</strong> ${ku} คน
      </div>
    `;

    // Duplicate for tear-off: Kitchen copy + Bakery copy
    content = `
      <h2 style="text-align:center; margin-bottom:8px;">🍽️🍰 ครัว + เบเกอรี่ — วันที่ ${date}</h2>
      <p style="text-align:center; font-size:12px; color:#555; margin-bottom:12px;">พิมพ์ 1 ครั้ง → ตัดตรงกลาง ส่งครัว 1 ชุด / เบเกอรี่ 1 ชุด</p>

      <!-- สำหรับครัว -->
      ${reportBody}

      <div style="text-align:center; margin:12px 0; border-top:2px dashed #c62828; padding-top:8px; color:#c62828; font-weight:700;">
        ✂️ ตัดตรงนี้ — ส่งครัว
      </div>

      <!-- สำหรับเบเกอรี่ (ซ้ำ) -->
      ${reportBody}

      <div style="text-align:center; margin-top:12px; color:#888; font-size:11px;">
        พิมพ์จากระบบ CC Cafe Reservation • ทัณฑสถานบำบัดพิเศษกลาง
      </div>
    `;
  }

  else if (type === 'table') {
    content = `<h2>🪑 รายงานการจัดโต๊ะ - ${date}</h2>`;
    content += `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:13px;">`;
    content += `<tr style="background:#f0f0f0;"><th>โต๊ะ</th><th>Ref No.</th><th>ผู้ต้องขัง</th><th>ผู้เยี่ยม</th><th>จำนวนคนทั้งหมด</th><th>สถานะการจอง</th></tr>`;

    let grandTotal = 0;

    filtered.forEach((r, i) => {
      const tableNo = i + 1;
      const ref = r.ref || '—';
      const prisoner = r.prisonerName ? `น.ช. ${r.prisonerName}` : '—';

      let visitors = [r.visitorName || '—'];
      const extras = parseExtraVisitors(r);
      extras.forEach((ex, ei) => {
        if (ex.name) {
          const ea = String(r.extraVisitorApproved || '').split(';;')[ei] || '';
          if (ea !== 'no') visitors.push(ex.name);
        }
      });

      const totalPeople = (parseInt(r.visitorCount) || 1) + 1;
      grandTotal += totalPeople;

      content += `<tr>`;
      content += `<td><strong>โต๊ะ ${tableNo}</strong></td>`;
      content += `<td>${ref}</td>`;
      content += `<td>${prisoner}</td>`;
      content += `<td>${visitors.join(' + ')}</td>`;
      content += `<td><strong>${totalPeople} คน</strong></td>`;
      content += `<td>${normalizeStatus(r.status)}</td>`;
      content += `</tr>`;
    });

    content += `</table>`;

    // Grand total at the bottom
    content += `<p style="margin-top:12px; font-weight:600; font-size:14px;">รวมทั้งหมด: <strong>${grandTotal} คน</strong> จาก ${filtered.length} โต๊ะ</p>`;
  }

  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html><head><meta charset="UTF-8"><title>รายงาน ${date}</title>
    <style>body{font-family:'Sarabun',sans-serif;padding:20px;font-size:14px;} table{width:100%;} h2{margin-bottom:16px;}</style>
    </head><body>
    ${content}
    <div style="margin-top:30px;font-size:11px;color:#888;">ผู้ปริ้น: ${currentUser?.displayName || currentUser?.username || 'ไม่ระบุ'} • พิมพ์เมื่อ ${now} • ทัณฑสถานบำบัดพิเศษกลาง</div>
    </body></html>
  `);
  printWin.document.close();
  setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
}

document.addEventListener('keydown', e => { if(e.key==='Escape') { closeModal(); closeDetailModal(); } });
document.getElementById('passInput').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('userInput').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
