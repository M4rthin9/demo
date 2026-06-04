// ===== CONFIG =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz7QfLcMh6oqW9LoDkKtWKxrPBfi1KIRRs-INH-ZDxHzKAyO4126NCFuAW9qbtwrQLFTg/exec';
const STAFF_PASS = '10900';

// ===== SAFE FETCH WRAPPER =====
async function appsScriptPost(payload) {
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response: ' + text.slice(0, 100));
  }
}

async function appsScriptGet(params) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(APPS_SCRIPT_URL + '?' + qs, { redirect: 'follow' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response: ' + text.slice(0, 100));
  }
}

// ===== TAB =====
let activeTab = 'ref';
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabRef').classList.toggle('active', tab === 'ref');
  document.getElementById('tabPrisoner').classList.toggle('active', tab === 'prisoner');
  document.getElementById('tabContentRef').classList.toggle('active', tab === 'ref');
  document.getElementById('tabContentPrisoner').classList.toggle('active', tab === 'prisoner');
}

// ===== Pre-fill from sessionStorage =====
window.addEventListener('load', () => {
  try {
    const lastRef = sessionStorage.getItem('lastRef');
    const lastPId = sessionStorage.getItem('lastPrisonerId');
    if (lastRef) {
      document.getElementById('searchRef').value = lastRef;
      switchTab('ref');
    } else if (lastPId) {
      document.getElementById('searchPrisoner').value = lastPId;
      switchTab('prisoner');
    }
  } catch(e) {}
});

// ===== SEARCH =====
async function doSearch() {
  let query = '';
  const mode = activeTab;
  if (mode === 'ref') {
    query = document.getElementById('searchRef').value.trim().toUpperCase();
    if (!query) { alert('กรุณากรอกเลขอ้างอิง'); return; }
  } else {
    query = document.getElementById('searchPrisoner').value.trim();
    if (!query) { alert('กรุณากรอกหมายเลขผู้ต้องขัง'); return; }
  }

  setOverlay(true, 'กำลังค้นหา...');
  document.getElementById('searchBtn').disabled = true;
  document.getElementById('resultArea').style.display = 'none';
  document.getElementById('thankYouArea').style.display = 'none';

  let rows = [];
  try {
    const data = await appsScriptGet({ action: 'getAll', pass: STAFF_PASS });
    if (data.status === 'ok') rows = data.rows || [];
    else throw new Error(data.message || 'error');
  } catch(err) {
    console.error('Fetch error:', err);
    if (APPS_SCRIPT_URL.includes('YOUR_GOOGLE')) {
      rows = getDemoRows();
    } else {
      setOverlay(false);
      document.getElementById('searchBtn').disabled = false;
      renderError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }
  } finally {
    setOverlay(false);
    document.getElementById('searchBtn').disabled = false;
  }

  // Filter - find upcoming bookings (not cancelled and not past completed)
  let found = null;
  const todayStr = toLocalDateStr(new Date());
  const completedStatus = ['เสร็จสิ้น', 'done'];
  const cancelledStatus = ['ยกเลิก', 'cancelled'];
  
  if (mode === 'ref') {
    found = rows.find(r => (r.ref || '').toUpperCase() === query);
  } else {
    const matches = rows.filter(r => String(r.prisonerId || '').trim() === query);
    if (matches.length > 0) {
      // Sort by visit date (earliest first) - use visitDateISO for reliable sorting
      const validMatches = matches
        .filter(r => {
          const rStatus = normalizeStatus(r.status);
          // Never show cancelled bookings
          if (cancelledStatus.includes(rStatus)) return false;
          // Show upcoming bookings, and completed bookings only if date hasn't passed
          if (completedStatus.includes(rStatus)) {
            const rDate = r.visitDateISO || parseThaiDateToISO(r.visitDate) || '';
            return String(rDate).trim() >= todayStr;
          }
          return true;
        })
        .sort((a, b) => {
          const d1 = a.visitDateISO || parseThaiDateToISO(a.visitDate) || '';
          const d2 = b.visitDateISO || parseThaiDateToISO(b.visitDate) || '';
          return String(d1).localeCompare(String(d2));
        });
      if (validMatches.length > 0) found = validMatches[0];
    }
  }

  if (!found) {
    renderNotFound(query);
  } else {
    renderResult(found);
  }
}

function renderError(msg) {
  const area = document.getElementById('resultArea');
  area.style.display = 'block';
  area.innerHTML = `
    <div style="background:var(--red-light);border:1px solid rgba(226,75,74,0.3);border-radius:var(--radius);padding:1.25rem;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:600;color:var(--red);margin-bottom:4px">เกิดข้อผิดพลาด</div>
      <div style="font-size:13px;color:#7a2020">${msg}</div>
    </div>`;
}

// ===== RENDER NOT FOUND =====
function renderNotFound(query) {
  const area = document.getElementById('resultArea');
  area.style.display = 'block';
  area.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div class="not-found">
        <div class="not-found-icon">🔍</div>
        <h3>ไม่พบข้อมูลการจอง</h3>
        <p>ไม่พบการจองสำหรับ <strong>"${escHtml(query)}"</strong><br>กรุณาตรวจสอบความถูกต้องของข้อมูลที่กรอก</p>
      </div>
    </div>
    <div style="margin-top:12px">
      <a href="booking.html" class="btn-primary" style="text-decoration:none">
        <i class="ti ti-plus"></i> จองใหม่
      </a>
    </div>
  `;
}

// ===== RENDER RESULT =====
let currentBooking = null;
let slipFile = null;
let slipUploaded = false;

function renderResult(row) {
  currentBooking = row;
  slipFile = null;
  slipUploaded = false;

  const status = row.status || 'รอตรวจสอบ';
  const statusPill = getStatusPill(status);
  const visitorCount = parseInt(row.visitorCount) || 1;
  const totalPersons = visitorCount + 1;
  const total = parseInt(row.total) || totalPersons * 1000;

  let visitorsDetailHtml = '';
  const mainAppr = (row.visitorApproved || '').trim();
  const mainLabel = mainAppr==='yes' ? '✅ เข้าได้' : mainAppr==='no' ? '❌ เข้าไม่ได้' : '';
  visitorsDetailHtml += `<div class="visitor-item"><span>👤 ${escHtml(row.visitorName||'—')}</span>${mainLabel ? '<span class="approval-badge '+(mainAppr==='yes'?'yes':mainAppr==='no'?'no':'pending')+'">'+mainLabel+'</span>' : ''}</div>`;
  if (row.extraVisitorNames && row.extraVisitorNames.trim()) {
    const isNew = row.extraVisitorNames.includes(';;') || row.extraVisitorNames.includes('|');
    let exs = [];
    if (isNew) {
      exs = row.extraVisitorNames.split(';;').map(e=>{const p=e.split('|');return {name:(p[0]||'').trim()};}).filter(e=>e.name);
    } else {
      exs = row.extraVisitorNames.split(/,(?![^(]*\))/).map(e=>{const m=e.trim().match(/^(.+?)\s*\(/);return {name:m?m[1].trim():e.trim()};}).filter(e=>e.name);
    }
    const eAppr = String(row.extraVisitorApproved||'').split(';;');
    exs.forEach((v,i)=>{
      const a = (eAppr[i]||'').trim();
      const lb = a==='yes'?'✅ เข้าได้':a==='no'?'❌ เข้าไม่ได้':'';
      visitorsDetailHtml += `<div class="visitor-item"><span>👤 ${escHtml(v.name)}</span>${lb ? '<span class="approval-badge '+(a==='yes'?'yes':a==='no'?'no':'pending')+'">'+lb+'</span>' : ''}</div>`;
    });
  }

  const area = document.getElementById('resultArea');
  area.style.display = 'block';

  let paymentBlock = '';
  const sLower = normalizeStatus(status).toLowerCase();

  if (sLower === 'รอชำระเงิน') {
    paymentBlock = `
      <div class="pay-section">
        <h3>✅ อนุมัติผู้เข้าร่วมแล้ว — กรุณาชำระเงิน</h3>
        <p>ฝ่ายวินัยอนุมัติผู้เข้าร่วมแล้ว กรุณาชำระเงินค่าบริการเพื่อยืนยันการเข้าร่วมกิจกรรม</p>
        <div style="text-align:center;margin-bottom:1rem">
          <div style="font-size:13px;color:var(--text2)">ยอดที่ต้องชำระ</div>
          <div style="font-size:28px;font-weight:700;color:var(--blue);margin:8px 0">${total.toLocaleString()} บาท</div>
          <div style="font-size:12px;color:var(--text2)">${totalPersons} คน × 1,000 บาท</div>
        </div>
        <button class="btn-primary" onclick="showPayment()">
          <i class="ti ti-credit-card"></i> ดำเนินการชำระเงิน
        </button>
      </div>
    `;
  } else if (sLower === 'ไม่อนุมัติ' || sLower === 'rejected') {
    paymentBlock = `
      <div class="rejected-notice">
        <h3>❌ การจองถูกปฏิเสธ</h3>
        <p>เจ้าหน้าที่ไม่สามารถอนุมัติการจองนี้ได้ เนื่องจากมีข้อมูลวินัยที่เกี่ยวข้อง หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ ณ ทัณฑสถาน</p>
      </div>
      <a href="booking.html" class="btn-secondary" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1rem">
        <i class="ti ti-plus"></i> จองใหม่
      </a>
    `;
  } else if (sLower === 'ชำระแล้ว' || sLower === 'paid') {
    paymentBlock = `
      <div class="paid-notice">
        <h3>💳 รอเจ้าหน้าที่ยืนยัน</h3>
        <p>ระบบได้รับสลิปการโอนเงินของท่านแล้ว เจ้าหน้าที่กำลังตรวจสอบและจะยืนยันนัดหมายของท่านภายใน 1 วันทำการ</p>
      </div>
    `;
  } else if (sLower === 'เสร็จสิ้น') {
    paymentBlock = `
      <div style="background:#d1fae5;border:1px solid rgba(6,95,70,0.25);border-radius:var(--radius);padding:1rem 1.25rem;margin-bottom:1rem;">
        <h3 style="color:#065f46;font-size:15px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">🎉 การจองเสร็จสมบูรณ์</h3>
        <p style="font-size:13px;color:#064e3b;line-height:1.7;">เจ้าหน้าที่ยืนยันการชำระเงินเรียบร้อยแล้ว กรุณานำเลขอ้างอิงมาแสดงในวันเข้าร่วมกิจกรรม</p>
      </div>
    `;
  } else if (sLower === 'ยกเลิก') {
    paymentBlock = `
      <div style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:var(--radius);padding:1rem 1.25rem;margin-bottom:1rem;">
        <h3 style="color:#374151;font-size:15px;font-weight:700;margin-bottom:6px;">🚫 การจองถูกยกเลิก</h3>
        <p style="font-size:13px;color:#6b7280;line-height:1.7;">การจองนี้ถูกยกเลิกแล้ว หากต้องการจองใหม่กรุณากดปุ่มด้านล่าง</p>
      </div>
      <a href="booking.html" class="btn-secondary" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1rem">
        <i class="ti ti-plus"></i> จองใหม่
      </a>
    `;
  } else {
    paymentBlock = `
      <div style="background:var(--gold-light);border:1px solid rgba(200,146,42,0.3);border-radius:var(--radius);padding:1rem 1.25rem;margin-bottom:1rem;">
        <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:4px;display:flex;align-items:center;gap:8px;">⏳ รอเจ้าหน้าที่ตรวจสอบ</div>
        <div style="font-size:13px;color:#7a5a10;line-height:1.7;">เจ้าหน้าที่กำลังตรวจสอบประวัติวินัยของผู้ต้องขัง (1–2 วันทำการ) กรุณาตรวจสอบสถานะอีกครั้งในภายหลัง</div>
      </div>
    `;
  }

  area.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div>
          <div class="result-ref">เลขอ้างอิง · <strong>${escHtml(row.ref || '—')}</strong></div>
          <div style="font-size:12px;color:var(--text2)">จองเมื่อ ${escHtml(row.timestamp || '—')}</div>
        </div>
        <div>${statusPill}</div>
      </div>
      <div class="result-body">
        <div class="info-row"><span class="lbl">👤 ผู้ร่วมกิจกรรม</span><span class="val">${escHtml(row.visitorName || '—')}</span></div>
        <div class="info-row"><span class="lbl">📞 โทรศัพท์</span><span class="val">${escHtml(row.visitorPhone || '—')}</span></div>
        <div class="info-row"><span class="lbl">🔒 ผู้ต้องขัง</span><span class="val">${escHtml(maskPrisonerName(row.prisonerName) || '—')} (#${escHtml(row.prisonerId || '—')})</span></div>
        <div class="info-row"><span class="lbl">🏢 แดน</span><span class="val">${escHtml(row.wing || '—')}</span></div>
        <div class="info-row"><span class="lbl">📅 วันที่ร่วมกิจกรรม</span><span class="val">${escHtml(row.visitDate || '—')}</span></div>
        <div class="info-row"><span class="lbl">👥 จำนวน</span><span class="val">ญาติ ${visitorCount} + ผู้ต้องขัง 1 = ${totalPersons} คน</span></div>
        <div class="info-row"><span class="lbl">💰 ค่าบริการอาหาร</span><span class="val">${total.toLocaleString()} บาท</span></div>
        ${visitorsDetailHtml ? `<div class="visitor-section"><div class="visitor-section-label">รายชื่อผู้เข้าเยี่ยม (สถานะหลังตรวจสอบ)</div>${visitorsDetailHtml}</div>` : ''}
      </div>
    </div>

    <div id="paymentArea">${paymentBlock}</div>

    <div id="paymentForm" style="display:none">
      <div class="section-title" style="margin-top:1rem;font-size:13px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
        <i class="ti ti-credit-card"></i> รายละเอียดการชำระเงิน
      </div>

      <div style="background:linear-gradient(135deg,#e8f4f8,#d0eaf3);border:2px solid #03b3c0;border-radius:var(--radius);padding:1.5rem;margin-bottom:1.25rem;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:8px;background:#03b3c0;color:#fff;font-size:13px;font-weight:700;padding:6px 18px;border-radius:20px;margin-bottom:14px;">
          📱 PromptPay QR Code
        </div>
        
        <div style="margin: 10px auto 15px; width: 200px; height: 200px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
          <img src="src/asset/promptpay-qr.png" alt="PromptPay QR Code" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <div style="font-size:16px;font-weight:700;color:#0a4a55;margin-bottom:4px;">ทัณฑสถานบำบัดพิเศษกลาง</div>
        <div style="font-size:14px;font-weight:600;color:#1a5a65;margin-bottom:12px;">ชื่อบัญชี: ร้านสงเคราะห์ผู้ต้องขัง</div>

        <div style="background:rgba(255,255,255,0.7);border-radius:8px;padding:10px 14px;font-size:13px;color:#1a5a65;line-height:1.8;">
          💰 ยอดที่ต้องชำระ: <strong style="font-size:18px;color:#0a4a55;">${total.toLocaleString()} บาท</strong><br>
          <span style="font-size:12px;color:#2a6a75;">${totalPersons} คน × 1,000 บาท</span>
        </div>
        <div style="margin-top:10px;background:rgba(255,255,255,0.8);border-radius:8px;padding:8px 14px;font-size:13px;color:#7a4a10;">
          📝 กรุณาระบุเลขอ้างอิง <strong>${escHtml(row.ref)}</strong> ในช่องหมายเหตุเมื่อโอน
        </div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:1rem;">
<div class="section-title" style="font-size:13px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
           <i class="ti ti-upload"></i> อัปโหลดสลิปการโอนเงิน
         </div>
         <div style="background:#fff7ed;border:1px solid #fdba7a;border-radius:var(--radius);padding:10px 14px;margin-bottom:12px;font-size:13px;color:#9a3412;line-height:1.6;">
           📋 หลังแนบสลิปแล้ว กรุณามาทำการลงทะเบียนในวันที่จอง ก่อนเวลาเข้าเยี่ยมในเวลา 9.00 ตามมาที่รับแขก
         </div>
        <div class="upload-area" id="uploadArea"
          ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
          <input type="file" accept="image/*,application/pdf" id="slipFileInput" onchange="handleUpload(event)">
          <div id="uploadInner">
            <div class="upload-icon">📄</div>
            <p>แตะหรือคลิกเพื่อเลือกรูปสลิป</p>
            <p class="hint">รองรับ JPG, PNG · ขนาดไม่เกิน 10MB · ลากไฟล์มาวางได้</p>
          </div>
          <img id="previewImg" class="preview-img" alt="สลิปที่อัปโหลด">
        </div>
        <div class="upload-progress" id="uploadProgress">
          <div class="upload-progress-bar" id="uploadProgressBar"></div>
        </div>
        <div id="uploadStatus" style="font-size:12px;color:var(--text2);margin-top:6px;min-height:16px"></div>
        <div class="alert-strip" id="uploadAlert"></div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:1rem">
        <button class="btn-secondary" onclick="hidePayment()" style="flex:0.4">
          <i class="ti ti-arrow-left"></i> ยกเลิก
        </button>
        <button class="btn-primary" onclick="submitPayment()" style="flex:1" id="paySubmitBtn">
          <i class="ti ti-check"></i> ยืนยันการชำระเงิน
        </button>
      </div>
    </div>

    <button class="btn-secondary" onclick="resetSearch()" style="margin-top:4px">
      <i class="ti ti-search"></i> ค้นหาอีกครั้ง
    </button>
  `;
}

// ===== STATUS PILL =====
function normalizeStatus(s) {
  const v = (s || '').toString().trim().toLowerCase();
  if (['อนุมัติ', 'approved', 'รอชำระเงิน'].includes(v)) return 'รอชำระเงิน';
  if (['rejected', 'ไม่อนุมัติ'].includes(v)) return 'ไม่อนุมัติ';
  if (['paid', 'ชำระแล้ว'].includes(v)) return 'ชำระแล้ว';
  if (['done', 'เสร็จสิ้น'].includes(v)) return 'เสร็จสิ้น';
  if (v === 'ยกเลิก') return 'ยกเลิก';
  return s || 'รอตรวจสอบ';
}

function getStatusPill(status) {
  const s = normalizeStatus(status);
  if (s === 'รอชำระเงิน') return `<span class="status-pill status-approved">✅ อนุมัติ — รอชำระเงิน</span>`;
  if (s.includes('อนุมัติ') || s === 'approved') return `<span class="status-pill status-approved">✅ อนุมัติแล้ว</span>`;
  if (s.includes('ไม่อนุมัติ') || s === 'rejected') return `<span class="status-pill status-rejected">❌ ไม่อนุมัติ</span>`;
  if (s === 'เสร็จสิ้น') return `<span class="status-pill status-paid" style="background:#d1fae5;color:#065f46;border-color:rgba(6,95,70,0.3)">✅ เสร็จสิ้นแล้ว</span>`;
  if (s.includes('ชำระ') || s === 'paid') return `<span class="status-pill status-paid">💳 รอเจ้าหน้าที่ยืนยัน</span>`;
  if (s === 'ยกเลิก') return `<span class="status-pill" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db">🚫 ยกเลิก</span>`;
  return `<span class="status-pill status-pending">⏳ รอตรวจสอบ</span>`;
}

// ===== SHOW/HIDE PAYMENT =====
function showPayment() {
  document.getElementById('paymentArea').style.display = 'none';
  document.getElementById('paymentForm').style.display = 'block';
  setTimeout(() => {
    const el = document.getElementById('paymentForm');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}
function hidePayment() {
  document.getElementById('paymentArea').style.display = 'block';
  document.getElementById('paymentForm').style.display = 'none';
}

// ===== DRAG & DROP =====
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('uploadArea').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

// ===== FILE UPLOAD HANDLER =====
function handleUpload(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showUploadAlert('err', '❌ ไฟล์ใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า');
    return;
  }
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    showUploadAlert('err', '❌ รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG) เท่านั้น');
    return;
  }
  slipFile = file;
  slipUploaded = true;
  hideUploadAlert();

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.getElementById('previewImg');
      img.src = ev.target.result;
      img.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('uploadInner').style.opacity = '0.4';
  document.getElementById('uploadStatus').innerHTML =
    `✓ เลือกไฟล์แล้ว: <strong>${escHtml(file.name)}</strong><br>` +
    `<span style="font-size:11px;color:var(--text2)">ขนาด: ${(file.size/1024).toFixed(1)} KB · จะอัปโหลดเมื่อกดยืนยัน</span>`;
}

function showUploadAlert(type, msg) {
  const el = document.getElementById('uploadAlert');
  el.className = 'alert-strip ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideUploadAlert() {
  const el = document.getElementById('uploadAlert');
  if (el) el.style.display = 'none';
}

// ===== UPLOAD SLIP TO APPS SCRIPT =====
async function uploadSlipViaAppsScript(file, ref) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.readAsDataURL(file);
  });

  animateProgress(10, 60);

  const result = await appsScriptPost({
    action: 'uploadSlip',
    pass: STAFF_PASS,
    ref: ref,
    fileName: file.name,
    mimeType: file.type,
    base64Data: base64
  });

  animateProgress(60, 100);

  if (result.status !== 'ok') {
    throw new Error(result.message || 'อัปโหลดไม่สำเร็จ');
  }
  return result.url;
}

function animateProgress(from, to) {
  const bar = document.getElementById('uploadProgressBar');
  const wrap = document.getElementById('uploadProgress');
  if (!bar || !wrap) return;
  wrap.style.display = 'block';
  bar.style.width = from + '%';
  setTimeout(() => { bar.style.width = to + '%'; }, 50);
}

// ===== SUBMIT PAYMENT =====
async function submitPayment() {
  if (!slipUploaded || !slipFile) {
    showUploadAlert('err', '❌ กรุณาเลือกรูปสลิปการโอนเงินก่อน');
    return;
  }
  if (!currentBooking) return;

  const submitBtn = document.getElementById('paySubmitBtn');
  submitBtn.disabled = true;
  setOverlay(true, 'กำลังอัปโหลดสลิป...');

  let slipUrl = '';
  try {
    slipUrl = await uploadSlipViaAppsScript(slipFile, currentBooking.ref);
  } catch (uploadErr) {
    console.error('Slip upload error:', uploadErr);
    setOverlay(false);
    submitBtn.disabled = false;
    const wrap = document.getElementById('uploadProgress');
    if (wrap) { wrap.style.display = 'none'; }
    showUploadAlert('err',
      '❌ อัปโหลดสลิปไม่สำเร็จ: ' + (uploadErr.message || 'กรุณาลองใหม่') +
      '<br>หากยังไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่');
    return;
  }

  setOverlay(true, 'กำลังบันทึกการชำระเงิน...');
  try {
    const result = await appsScriptPost({
      action: 'updateSlipAndStatus',
      pass: STAFF_PASS,
      ref: currentBooking.ref,
      status: 'ชำระแล้ว',
      slipImage: slipUrl
    });
    if (result.status !== 'ok') throw new Error(result.message || 'บันทึกไม่สำเร็จ');
  } catch (err) {
    console.error('Update status error:', err);
  } finally {
    setOverlay(false);
  }

  showThankYou();
}

function showThankYou() {
  const row = currentBooking;
  const visitorCount = parseInt(row.visitorCount) || 1;
  const totalPersons = visitorCount + 1;
  const total = parseInt(row.total) || totalPersons * 1000;

  document.getElementById('resultArea').style.display = 'none';
  document.getElementById('thankYouArea').style.display = 'block';
  document.getElementById('tyRefNumber').textContent = row.ref;

document.getElementById('tySummary').innerHTML = `
     <div>📋 <strong>Ref No.:</strong> ${escHtml(row.ref)}</div>
     <div>👤 <strong>ผู้ร่วมกิจกรรม:</strong> ${escHtml(row.visitorName)}</div>
     <div>🔒 <strong>ผู้ต้องขัง:</strong> ${escHtml(maskPrisonerName(row.prisonerName))} (#${escHtml(row.prisonerId)})</div>
     <div>🏢 <strong>แดน:</strong> ${escHtml(row.wing)}</div>
     <div>📅 <strong>วันที่:</strong> ${escHtml(row.visitDate)}</div>
     <div>👥 <strong>จำนวน:</strong> ${totalPersons} คน</div>
     <div>💰 <strong>ยอดชำระ:</strong> ${total.toLocaleString()} บาท ✓</div>
   `;
  window.scrollTo(0, 0);
}

// ===== RESET =====
function resetSearch() {
  document.getElementById('searchRef').value = '';
  document.getElementById('searchPrisoner').value = '';
  document.getElementById('resultArea').style.display = 'none';
  document.getElementById('thankYouArea').style.display = 'none';
  currentBooking = null;
  slipFile = null;
  slipUploaded = false;
  window.scrollTo(0, 0);
}

// ===== OVERLAY =====
function setOverlay(show, msg) {
  const el = document.getElementById('overlay');
  el.classList.toggle('show', show);
  if (msg) document.getElementById('overlayMsg').textContent = msg;
}

// ===== UTILS =====
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseThaiDateToISO(dateStr) {
  if (!dateStr) return '';
  const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const match = dateStr.match(/(\d+)\s*(?:วัน)?\s*([^\s]+)\s*(?:พ\.ศ\.|พศ\.|)\s*(\d+)/);
  if (match) {
    const day = String(match[1]).padStart(2, '0');
    const monthName = match[2];
    const year = parseInt(match[3]) - 543; // convert Buddhist era to AD
    const month = String(thMonths.indexOf(monthName) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(dateStr).trim();
}

function maskPrisonerName(name) {
  if (!name || name === '—') return name;
  const trimmed = name.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 0) {
    const firstName = trimmed.substring(0, lastSpace + 1);
    const lastName = trimmed.substring(lastSpace + 1);
    const maskedLast = lastName.slice(0, 4);
    return firstName + maskedLast;
  }
  return trimmed.length > 3 ? trimmed.slice(0, 3) : trimmed;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== DEMO DATA =====
function getDemoRows() {
  return [
    {
      ref: 'VIS-12345',
      timestamp: '21/5/2569 10:30',
      visitorName: 'สมชาย ใจดี',
      visitorId: '1234567890123',
      visitorPhone: '081-234-5678',
      relation: 'คู่สมรส',
      extraVisitorNames: 'สมหญิง ใจดี|1234567890124|คู่สมรส;;น้องชาย ใจดี|1234567890125|พี่น้อง',
      visitorApproved: 'yes',
      extraVisitorApproved: 'yes;;no',
      prisonerName: 'สมศักดิ์ มั่นคง',
      prisonerId: '56781234',
      wing: 'แดน 3',
      visitDate: 'วันจันทร์ที่ 25 พฤษภาคม พ.ศ. 2569',
      visitDateISO: '2026-05-25',
      visitorCount: 2,
      totalPersons: 3,
      total: 2000,
      status: 'รอชำระเงิน'
    },
    {
      ref: 'VIS-67890',
      timestamp: '20/5/2569 14:15',
      visitorName: 'มาลี สุขใจ',
      visitorId: '9876543210987',
      visitorPhone: '089-876-5432',
      relation: 'บุตร / ธิดา',
      prisonerName: 'วิชัย รักชาตี',
      prisonerId: '11223344',
      wing: 'แดน 7',
      visitDate: 'วันอังคารที่ 26 พฤษภาคม พ.ศ. 2569',
      visitDateISO: '2026-05-26',
      visitorCount: 1,
      totalPersons: 2,
      total: 2000,
      status: 'รอตรวจสอบ'
    },
    {
      ref: 'VIS-22222',
      timestamp: '30/5/2569 09:00',
      visitorName: 'สมศักดิ์ ทดสอบ',
      visitorId: '1111111111111',
      visitorPhone: '081-111-1111',
      relation: 'บุตร / ธิดา',
      prisonerName: 'สมศักดิ์ มั่นคง',
      prisonerId: '56781234',
      wing: 'แดน 3',
      visitDate: 'วันจันทร์ที่ 2 มิถุนายน พ.ศ. 2569',
      visitDateISO: '2026-06-02',
      visitorCount: 1,
      totalPersons: 2,
      total: 2000,
      status: 'เสร็จสิ้น'
    },
    {
      ref: 'VIS-33333',
      timestamp: '30/5/2569 10:00',
      visitorName: 'สมหญิง ตรวจสอบ',
      visitorId: '2222222222222',
      visitorPhone: '081-222-2222',
      relation: 'คู่สมรส',
      prisonerName: 'สมศักดิ์ มั่นคง',
      prisonerId: '56781234',
      wing: 'แดน 3',
      visitDate: 'วันพุธที่ 4 มิถุนายน พ.ศ. 2569',
      visitDateISO: '2026-06-04',
      visitorCount: 1,
      totalPersons: 2,
      total: 2000,
      status: 'รอตรวจสอบ'
    }
  ];
}
