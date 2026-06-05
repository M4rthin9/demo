const SHEET_NAME = 'การจอง';
const EVENTLOG_SHEET = 'EventLog';
const PRISONER_SHEET = 'ผู้ต้องขัง';
const USERS_SHEET = 'Users';

const LEGACY_STAFF_PASS = '10900';

const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  FINANCE: 'finance',
  DISCIPLINE_OFFICER: 'discipline_officer',
  DISCIPLINARY_DEPT: 'disciplinary_dept',
  USER: 'user'
};

const AVAILABLE_PERMISSIONS = [
  'approve', 'reject', 'confirm_payment', 'reject_payment', 'cancel', 
  'visitor_approval', 'view_slip', 'view_detail', 'export', 'print', 
  'manage_users', 'view_eventlog'
];

const PERMISSIONS = {
  Superadmin: ['approve', 'reject', 'confirm_payment', 'reject_payment', 'cancel', 'visitor_approval', 'view_slip', 'view_detail', 'export', 'print', 'manage_users', 'view_eventlog'],
  Admin: ['approve', 'reject', 'confirm_payment', 'reject_payment', 'cancel', 'visitor_approval', 'view_slip', 'view_detail', 'export', 'print', 'view_eventlog'],
  Finance: ['confirm_payment', 'reject_payment', 'cancel', 'view_slip', 'view_detail'],
  Vinai: ['approve', 'view_slip', 'view_detail'],
  Tadtel: ['approve_participant', 'visitor_approval', 'view_slip', 'view_detail'],
  User: ['print']
};

// ===== GET =====
function doGet(e) {
  const params = e.parameter;
  const action = params.action || '';
  const pass   = params.pass  || '';
  const username = params.username || '';

  // Legacy support for old getAll calls
  if (action === 'getAll') {
    const isPublicAccess = !username && !pass || username === 'public';
    if (!isPublicAccess && !isAuthorized(username, pass)) {
      return jsonResp({ status: 'error', message: 'Unauthorized' });
    }
    const sheet = getMainSheet();
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResp({ status: 'ok', rows: [] });

    const headers = data[0];
    const refIdx  = headers.indexOf('ref');
    const rows = data.slice(1)
      .filter(row => row[refIdx] && String(row[refIdx]).trim() !== '')
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (val instanceof Date) {
            if (h === 'visitDateISO') {
              const y = val.getFullYear();
              const m = String(val.getMonth() + 1).padStart(2, '0');
              const d = String(val.getDate()).padStart(2, '0');
              val = y + '-' + m + '-' + d;
            } else {
              val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
            }
          }
          obj[h] = val;
        });
        return obj;
      });
    return jsonResp({ status: 'ok', rows: rows.reverse() });
  }

  // New: get event logs (can be called with username)
  if (action === 'getEventLogs') {
    if (!isAuthorized(username, pass)) {
      return jsonResp({ status: 'error', message: 'Unauthorized' });
    }
    const logs = getEventLogs(params);
    return jsonResp({ status: 'ok', logs: logs });
  }

  // ===== Prisoner master data for booking autocomplete (public) =====
  if (action === 'getPrisoners') {
    // Public endpoint - MUST read from Prisoner Database sheet (ไม่ใช่ sheet การจอง)
    const sheet = getPrisonerSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResp({ status: 'ok', prisoners: [] });

    const headers = data[0];
    const nameIdx = headers.indexOf('prisonerName');
    const idIdx   = headers.indexOf('prisonerId');
    const wingIdx = headers.indexOf('wing');

    const prisoners = [];
    const seen = new Set();

    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][nameIdx] || '').trim();
      const id   = String(data[i][idIdx] || '').trim();
      const wing = String(data[i][wingIdx] || '').trim();

      if (!name || !id) continue;

      const key = id + '|' + name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      prisoners.push({
        prisonerName: name,
        prisonerId: id,
        wing: wing
      });
    }

// Sort by name (Thai friendly)
    prisoners.sort((a, b) => a.prisonerName.localeCompare(b.prisonerName, 'th'));

    return jsonResp({ status: 'ok', prisoners: prisoners });
  }

  // ===== GET ROLES LIST =====
  if (action === 'getRoles') {
    if (!isAuthorized(username, pass)) {
      return jsonResp({ status: 'error', message: 'Unauthorized' });
    }
    const roles = getRolesList();
    return jsonResp({ status: 'ok', roles: roles });
  }

  // ===== GET USERS LIST =====
  if (action === 'getUsers') {
    if (!isAuthorized(username, pass)) {
      return jsonResp({ status: 'error', message: 'Unauthorized' });
    }
    const users = getAllUsers().map(u => ({
      username: u.username,
      role: u.role,
      displayName: u.displayName || u.username,
      createdAt: u.createdAt
    }));
    return jsonResp({ status: 'ok', users: users });
  }

  // ===== NEW: Connection test / health check endpoint =====
  if (action === 'testConnection') {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const allSheets = listAllSheets();
      const mainSheet = getMainSheet();
      const mainSheetInfo = {
        name: mainSheet.getName(),
        rows: mainSheet.getLastRow(),
        cols: mainSheet.getLastColumn(),
        headers: mainSheet.getLastRow() > 0 ? mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0] : []
      };
      return jsonResp({
        status: 'ok',
        message: 'Connection successful',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        allSheets: allSheets,
        mainSheet: mainSheetInfo,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      return jsonResp({
        status: 'error',
        message: 'Connection failed: ' + e.toString(),
        error: e.toString()
      });
    }
  }

  // ===== NEW: Get sheet structure info for debugging =====
  if (action === 'getSheetInfo') {
    if (!isAuthorized(username, pass)) {
      return jsonResp({ status: 'error', message: 'Unauthorized' });
    }
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const allSheets = listAllSheets();
      const mainSheet = getMainSheet();
      
      // Get detailed header info
      let headers = [];
      let sampleData = [];
      if (mainSheet.getLastRow() > 0) {
        headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
        if (mainSheet.getLastRow() > 1) {
          // Get first data row as sample
          sampleData = mainSheet.getRange(2, 1, 1, mainSheet.getLastColumn()).getValues()[0];
        }
      }
      
      return jsonResp({
        status: 'ok',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        allSheets: allSheets,
        mainSheet: {
          name: mainSheet.getName(),
          totalRows: mainSheet.getLastRow(),
          totalCols: mainSheet.getLastColumn(),
          headers: headers,
          sampleRow: sampleData
        }
      });
    } catch (e) {
      return jsonResp({
        status: 'error',
        message: 'Failed to get sheet info: ' + e.toString()
      });
    }
  }

  return jsonResp({ status: 'error', message: 'Unknown action' });
}

// ===== POST =====
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResp({ status: 'error', message: 'Invalid JSON' }); }

  const action = body.action || 'saveReservation';
  const username = body.username || body.user || 'public';
  const pass = body.pass || body.password || '';

  // ===== LOGIN ACTION =====
  if (action === 'login') {
    const user = getUserByUsername(username);
    if (!user) {
      return jsonResp({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัดผ่านไม่ถูกต้อง' });
    }
    if (String(user.password) !== String(pass)) {
      return jsonResp({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัดผ่านไม่ถูกต้อง' });
    }
    return jsonResp({
      status: 'ok',
      user: { username: user.username, role: user.role, displayName: user.displayName || user.username }
    });
  }

  // ===== CHANGE PASSWORD (FIRST TIME LOGIN) =====
  if (action === 'changePassword') {
    const newPassword = body.newPassword || '';
    const confirmPassword = body.confirmPassword || '';
    
    if (!newPassword || newPassword.length < 6) {
      return jsonResp({ status: 'error', message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }
    if (newPassword !== confirmPassword) {
      return jsonResp({ status: 'error', message: 'รหัสผ่านไม่ตรงกัน' });
    }
    
    const success = updatePassword(username, newPassword);
    if (success) {
      logEvent(username, 'password_changed', '', { method: 'first_time_login' }, 'success');
      return jsonResp({ status: 'ok', message: 'เปลี่ยนรหัดผ่านสำเร็จ กรุณาเข้าระบบใหม่' });
    }
    return jsonResp({ status: 'error', message: 'ไม่สามารถเปลี่ยนรหัดผ่านได้' });
  }

// ===== CREATE NEW USER (SUPERADMIN ONLY) =====
  if (action === 'createUser') {
    if (username.toLowerCase() !== 'superadmin' && !hasPermission(username, 'manage_users')) {
      return jsonResp({ status: 'error', message: 'Only superadmin can create users' });
    }

    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const newUsername = body.username?.trim();
    const newPassword = body.password?.trim();
    const newRole = body.role?.trim();

    if (!newUsername || !newPassword || !newRole) {
      return jsonResp({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบ (username, password, role)' });
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][headers.indexOf('username')]).toLowerCase() === newUsername.toLowerCase()) {
        return jsonResp({ status: 'error', message: 'ชื่อผู้ใช้นั้นมีอยู่แล้ว' });
      }
    }

    sheet.appendRow([
      newUsername,
      newPassword,
      newRole,
      newUsername + '_display',
      new Date().toISOString()
    ]);

    logEvent(username, 'create_user', newUsername, { role: newRole });
    return jsonResp({ status: 'ok', message: 'ผู้ใช้ถูกสร้างสำเร็จ', user: { username: newUsername, role: newRole } });
  }

// ===== CREATE CUSTOM ROLE (SUPERADMIN ONLY) =====
  if (action === 'createRole') {
    if (!hasPermission(username, 'manage_users')) {
      return jsonResp({ status: 'error', message: 'เฉพาะผู้ดูแลสูงสุดเท่านั้นที่สามารถสร้างบทบาทใหม่ได้' });
    }

    const roleName = body.roleName?.trim();
    const permissionsInput = body.permissions;

    if (!roleName) {
      return jsonResp({ status: 'error', message: 'กรุณากรอกชื่อบทบาท' });
    }

    if (!Array.isArray(permissionsInput) || permissionsInput.length === 0) {
      return jsonResp({ status: 'error', message: 'กรุณาเลือกอย่างน้อยหนึ่งสิทธิ์สำหรับบทบาท' });
    }

    const invalidPermissions = permissionsInput.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return jsonResp({ status: 'error', message: 'สิทธิ์ต่อไปนี้ไม่ถูกต้อง: ' + invalidPermissions.join(', ') });
    }

    const rolesSheet = getRolesSheet();
    const rolesData = rolesSheet.getDataRange().getValues();
    const roleHeaders = rolesData[0];
    const roleNameIdx = roleHeaders.indexOf('roleName');

    if (roleNameIdx === -1) {
      ensureRolesHeaders(rolesSheet);
      rolesSheet.getRange(1, 1, 1, AVAILABLE_PERMISSIONS.length + 2).setValue([
        'roleName', ...AVAILABLE_PERMISSIONS
      ]);
    }

    for (let i = 1; i < rolesData.length; i++) {
      if (String(rolesData[i][roleNameIdx]).toLowerCase() === roleName.toLowerCase()) {
        return jsonResp({ status: 'error', message: 'ชื่อบทบาทนี้มีอยู่แล้วในระบบ' });
      }
    }

    const rowValues = [roleName];
    AVAILABLE_PERMISSIONS.forEach(perm => {
      rowValues.push(permissionsInput.includes(perm) ? true : false);
    });

    rolesSheet.appendRow(rowValues);

logEvent(username, 'create_role', roleName, { permissions: permissionsInput });
    return jsonResp({
      status: 'ok',
      message: 'สร้างบทบาทสำเร็จ',
      role: { roleName, permissions: permissionsInput }
    });
  }

  if (action === 'logClientEvent') {
    logEvent(username || 'client', body.clientAction || 'client_action', body.targetRef || '', body.details || {}, 'success');
    return jsonResp({ status: 'ok' });
  }

  // ===== PUBLIC: New reservation (from booking form) =====
  if (action === 'saveReservation' || !action) {
    const sheet = getMainSheet();
    ensureHeaders(sheet);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow  = headers.map(h => body[h] !== undefined ? body[h] : '');
    sheet.appendRow(newRow);

    logEvent('public', 'booking_submitted', body.ref || '', { visitorName: body.visitorName, prisonerName: body.prisonerName, visitDate: body.visitDate }, 'success');

    // Optional email notification (kept from original)
    try {
      const adminEmail = Session.getActiveUser().getEmail();
      if (adminEmail) {
        MailApp.sendEmail({
          to: adminEmail,
          subject: `[จองใหม่ — รอตรวจสอบวินัย] ${body.ref} — ${body.visitorName}`,
          body: `มีคำขอจองเยี่ยมใหม่ที่รอตรวจสอบประวัติวินัย\n\n` +
                `เลขอ้างอิง : ${body.ref}\n` +
                `ผู้เยี่ยม  : ${body.visitorName} (${body.visitorPhone})\n` +
                `ความสัมพันธ์: ${body.relation}\n` +
                `ผู้ต้องขัง : ${body.prisonerName} (#${body.prisonerId})\n` +
                `แดน        : ${body.wing}\n` +
                `วันที่เยี่ยม: ${body.visitDate}\n` +
                `จำนวน      : ญาติ ${body.visitorCount} คน + ผู้ต้องขัง 1 = ${body.totalPersons} คน\n` +
                `ค่าบริการ  : ${body.total} บาท\n\n` +
                `กรุณาเข้าระบบเพื่อตรวจสอบและอนุมัติ/ไม่อนุมัติ`
        });
      }
    } catch(mailErr) { /* ignore */ }

    return jsonResp({ status: 'ok', ref: body.ref });
  }

  // ===== Public actions (no login required) =====
 const publicActions = ['uploadSlip', 'updateSlipAndStatus'];
 if (publicActions.includes(action) && (username === 'public' || !username)) {
   // allow public slip upload / payment confirmation
 } else if (!publicActions.includes(action) && !isAuthorized(username, pass)) {
   logEvent(username || 'unknown', action, body.ref || '', { reason: 'unauthorized' }, 'denied');
   return jsonResp({ status: 'error', message: 'Unauthorized' });
 }

 // ── get all reservations (POST) ──
 if (action === 'getAll') {
   const sheet = getMainSheet();
   const data = sheet.getDataRange().getValues();
   if (data.length <= 1) return jsonResp({ status: 'ok', rows: [] });

   const headers = data[0];
   const rows = data.slice(1)
     .filter(row => row[headers.indexOf('ref')] && String(row[headers.indexOf('ref')]).trim() !== '')
     .map(row => {
       const obj = {};
       headers.forEach((h, i) => {
         let val = row[i];
         if (val instanceof Date) {
           if (h === 'visitDateISO') {
             const y = val.getFullYear();
             const m = String(val.getMonth() + 1).padStart(2, '0');
             const d = String(val.getDate()).padStart(2, '0');
             val = y + '-' + m + '-' + d;
           } else {
             val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
           }
         }
         obj[h] = val;
       });
       return obj;
     });
   return jsonResp({ status: 'ok', rows: rows.reverse() });
 }

   // ── CANCEL BOOKING ──
   if (action === 'cancelBooking') {
     const sheet = getMainSheet();
     const data  = sheet.getDataRange().getValues();
     const refIdx    = data[0].indexOf('ref');
     const statusIdx = data[0].indexOf('status');
     for (let i = 1; i < data.length; i++) {
       if (String(data[i][refIdx]).trim() === String(body.ref).trim()) {
         sheet.getRange(i + 1, statusIdx + 1).setValue('ยกเลิก');
         logEvent(username, 'booking_cancelled', body.ref, { previousStatus: data[i][statusIdx] }, 'success');
         return jsonResp({ status: 'ok' });
       }
     }
     return jsonResp({ status: 'error', message: 'Ref not found' });
   }

   // ── UPDATE STATUS (approve / reject / mark paid etc.) ──
   if (action === 'updateStatus') {
     const sheet = getMainSheet();
     const data  = sheet.getDataRange().getValues();
     const refIdx    = data[0].indexOf('ref');
     const statusIdx = data[0].indexOf('status');
     for (let i = 1; i < data.length; i++) {
       if (String(data[i][refIdx]).trim() === String(body.ref).trim()) {
         const oldStatus = data[i][statusIdx];
         sheet.getRange(i + 1, statusIdx + 1).setValue(body.status);
         logEvent(username, 'status_changed', body.ref, { oldStatus, newStatus: body.status }, 'success');
         return jsonResp({ status: 'ok' });
       }
     }
     return jsonResp({ status: 'error', message: 'Ref not found' });
   }

  // ── UPDATE VISITOR APPROVAL (per person) ──
  if (action === 'updateVisitorApproval') {
    if (!body.ref) return jsonResp({ status: 'error', message: 'Missing ref' });

    const sheet = getMainSheet();
    let data  = sheet.getDataRange().getValues();
    let headers = data[0];
    const refIdx = headers.indexOf('ref');

    let vaIdx = headers.indexOf('visitorApproved');
    let evaIdx = headers.indexOf('extraVisitorApproved');
    if (vaIdx === -1 || evaIdx === -1) {
      let nextCol = headers.length + 1;
      if (vaIdx === -1) { sheet.getRange(1, nextCol).setValue('visitorApproved'); vaIdx = nextCol - 1; nextCol++; }
      if (evaIdx === -1) { sheet.getRange(1, nextCol).setValue('extraVisitorApproved'); evaIdx = nextCol - 1; }
      data = sheet.getDataRange().getValues();
      headers = data[0];
      vaIdx = headers.indexOf('visitorApproved');
      evaIdx = headers.indexOf('extraVisitorApproved');
    }

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][refIdx]).trim() === String(body.ref).trim()) {
        rowIndex = i; break;
      }
    }
    if (rowIndex === -1) return jsonResp({ status: 'error', message: 'Ref not found' });

    const row = rowIndex + 1;
    if (body.visitorApproved !== undefined) sheet.getRange(row, vaIdx + 1).setValue(body.visitorApproved);
    if (body.extraVisitorApproved !== undefined) sheet.getRange(row, evaIdx + 1).setValue(body.extraVisitorApproved);

    // Recalc price
    const mainApproved = (body.visitorApproved || '').toString().trim().toLowerCase() === 'yes' ? 1 : 0;
    let extraYesCount = 0;
    if (body.extraVisitorApproved) {
      extraYesCount = String(body.extraVisitorApproved).split(';;').filter(v => (v || '').toString().trim().toLowerCase() === 'yes').length;
    }
    const approvedRelatives = mainApproved + extraYesCount;
    const correctVisitorCount = approvedRelatives;
    const correctTotal = (approvedRelatives + 1) * 1000;

    const vcIdx = headers.indexOf('visitorCount');
    const tIdx  = headers.indexOf('total');
    if (vcIdx > -1) sheet.getRange(row, vcIdx + 1).setValue(correctVisitorCount);
    if (tIdx  > -1) sheet.getRange(row, tIdx  + 1).setValue(correctTotal);

    logEvent(username, 'visitor_approval_updated', body.ref, { visitorApproved: body.visitorApproved, extraVisitorApproved: body.extraVisitorApproved, visitorCount: correctVisitorCount, total: correctTotal }, 'success');
    return jsonResp({ status: 'ok', visitorCount: correctVisitorCount, total: correctTotal });
  }

  // ── UPLOAD SLIP (public or staff) ──
  if (action === 'uploadSlip') {
    if (!body.base64Data) return jsonResp({ status: 'error', message: 'Missing base64Data' });
    if (!body.ref) return jsonResp({ status: 'error', message: 'Missing ref' });
    try {
      const url = saveSlipToDrive(body.ref, body.base64Data, body.mimeType || '', body.fileName || '');
      logEvent(username || 'public', 'slip_uploaded', body.ref, {}, 'success');
      return jsonResp({ status: 'ok', url: url });
    } catch(e) {
      Logger.log('uploadSlip error: ' + e.toString());
      logEvent(username || 'public', 'slip_upload_failed', body.ref, { error: e.toString() }, 'error');
      return jsonResp({ status: 'error', message: e.toString() });
    }
  }

  // ── UPDATE SLIP + STATUS ──
  if (action === 'updateSlipAndStatus') {
    const sheet = getMainSheet();
    const data  = sheet.getDataRange().getValues();
    const headers    = data[0];
    const refIdx     = headers.indexOf('ref');
    const statusIdx  = headers.indexOf('status');
    const slipIdx    = headers.indexOf('slipImage');
    for (let i = 1; i < data.length; i++) {
      if (data[i][refIdx] === body.ref) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(body.status || 'ชำระแล้ว');
        if (slipIdx >= 0 && body.slipImage) {
          let slipVal = body.slipImage;
          if (slipVal.startsWith('data:image')) {
            try { slipVal = saveSlipToDrive(body.ref, slipVal); } catch(e) { slipVal = 'SLIP_UPLOADED:' + new Date().toISOString(); }
          }
          sheet.getRange(i + 1, slipIdx + 1).setValue(slipVal);
        }
        logEvent(username, 'slip_and_status_updated', body.ref, { status: body.status }, 'success');
        return jsonResp({ status: 'ok' });
      }
    }
    return jsonResp({ status: 'error', message: 'Ref not found' });
  }

  return jsonResp({ status: 'error', message: 'Unknown action' });
}

// ===== EVENT LOG =====
function logEvent(username, action, targetRef, details, result) {
  const sheet = getEventLogSheet();
  const ts = new Date();
  const detailsStr = (details && typeof details === 'object') ? JSON.stringify(details) : (details || '');
  sheet.appendRow([
    Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    username || 'system',
    action,
    targetRef || '',
    detailsStr,
    result || 'success',
    '', // ip (client can send later if needed)
    ''  // userAgent
  ]);
}

function getEventLogs(params) {
  const sheet = getEventLogSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  }).reverse(); // newest first

  // Basic filtering
  let filtered = rows;
  if (params.fromDate) filtered = filtered.filter(r => r.timestamp >= params.fromDate);
  if (params.toDate) filtered = filtered.filter(r => r.timestamp <= params.toDate + ' 23:59:59');
  if (params.username) filtered = filtered.filter(r => String(r.username).toLowerCase().includes(String(params.username).toLowerCase()));
  if (params.action) filtered = filtered.filter(r => String(r.action).toLowerCase().includes(String(params.action).toLowerCase()));
  if (params.search) {
    const s = String(params.search).toLowerCase();
    filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(s));
  }
  return filtered.slice(0, 500); // safety limit
}

// ===== EVENT LOG SHEET =====
function getEventLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTLOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTLOG_SHEET);
    ensureEventLogHeaders(sheet);
  }
  return sheet;
}

function ensureEventLogHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = ['timestamp', 'username', 'action', 'targetRef', 'details', 'result', 'ip', 'userAgent'];
  sheet.appendRow(headers);
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#185FA5');
  range.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

// ===== MAIN RESERVATION SHEET =====
function getMainSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    ensureHeaders(sheet);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = [
    'ref','timestamp','visitorName','visitorId','visitorPhone','relation',
    'religion','allergy','extraVisitorReligions','extraVisitorAllergies',
    'extraVisitorNames','visitorApproved','extraVisitorApproved',
    'prisonerName','prisonerId','wing','visitDate','visitDateISO',
    'visitorCount','totalPersons','total','adultCount','child5to8Count','childUnder5Count','status','slipImage'
  ];
  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#185FA5');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  const slipCol = headers.indexOf('slipImage') + 1;
  if (slipCol > 0) sheet.hideColumns(slipCol);
}

// ===== SLIP TO DRIVE =====
function saveSlipToDrive(ref, base64Data, mimeTypeOverride, fileNameOverride) {
  const matches = base64Data.match(/^data:([a-zA-Z0-9+\/]+\/[a-zA-Z0-9+\/]+);base64,(.+)$/);
  let mimeType, rawBase64;
  if (matches) {
    mimeType = mimeTypeOverride || matches[1];
    rawBase64 = matches[2];
  } else if (mimeTypeOverride) {
    mimeType = mimeTypeOverride;
    rawBase64 = base64Data;
  } else {
    throw new Error('Invalid base64 format');
  }

  const ext = mimeType.split('/')[1].replace('jpeg','jpg').replace('jpg','jpg');
  const fileName = fileNameOverride || ('slip_' + ref + '_' + new Date().getTime() + '.' + ext);
  let blob;
  try {
    blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), mimeType, fileName);
  } catch(decodeErr) {
    throw new Error('base64 decode failed: ' + decodeErr.message);
  }

  const folderName = 'VisitorSlips';
  const folderIter = DriveApp.getFoldersByName(folderName);
  const folder = folderIter.hasNext() ? folderIter.next() : DriveApp.createFolder(folderName);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
}

// ===== PRISONER MASTER DATABASE =====
function getPrisonerSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PRISONER_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PRISONER_SHEET);
    ensurePrisonerHeaders(sheet);
  }
  return sheet;
}

function ensurePrisonerHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = ['prisonerId', 'prisonerName', 'wing', 'status', 'note'];
  sheet.appendRow(headers);
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#185FA5');
  range.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

// ===== USER MANAGEMENT =====
function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET);
  }
  ensureUserHeadersAndUsers(sheet);
  return sheet;
}

function ensureUserHeadersAndUsers(sheet) {
  // Always ensure headers exist (for new or empty sheets)
  if (sheet.getLastRow() === 0) {
    const headers = ['username', 'password', 'role', 'displayName', 'createdAt'];
    sheet.appendRow(headers);
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight('bold');
    range.setBackground('#185FA5');
    range.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  
  // Seed default users only if no users exist AND not in production mode
  // Check script property: set DISABLE_SEED_USERS=true in production
  const scriptProps = PropertiesService.getScriptProperties();
  const disableSeed = scriptProps.getProperty('DISABLE_SEED_USERS');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1 && disableSeed !== 'true') {
    seedDefaultUsers(sheet);
  }
}

function seedDefaultUsers(sheet) {
  const now = new Date().toISOString();
  const defaultUsers = [
    ['superadmin', 'SuperAdmin@10900', 'Superadmin', 'ผู้ดูแลระบบ', now],
    ['finance', 'Finance@10900', 'Finance', 'การเงิน', now],
    ['vinai', 'Vinai@10900', 'Vinai', 'ตรวจสอบวินัย', now],
    ['tadtel', 'Tadtel@10900', 'Tadtel', 'ฝ่ายทัณฑ์', now]
  ];
  defaultUsers.forEach(user => sheet.appendRow(user));
}

function getUserByUsername(username) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][headers.indexOf('username')]).toLowerCase() === String(username).toLowerCase()) {
      const user = {};
      headers.forEach((h, idx) => user[h] = data[i][idx]);
      return user;
    }
  }
  return null;
}

function getAllUsers() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

// ===== ROLES MANAGEMENT =====
function getRolesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Roles');
  if (!sheet) {
    sheet = ss.insertSheet('Roles');
    ensureRolesHeaders(sheet);
  }
  return sheet;
}

function ensureRolesHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = ['roleName', ...AVAILABLE_PERMISSIONS];
  sheet.appendRow(headers);
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#185FA5');
  range.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}


function getRolesList() {
  const rolesSheet = getRolesSheet();
  const data = rolesSheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rolesList = [];
  for (let i = 1; i < data.length; i++) {
    const roleName = data[i][0];
    const permissions = [];
    for (let j = 1; j < headers.length; j++) {
      if (data[i][j] === true) {
        permissions.push(headers[j]);
      }
    }
    rolesList.push({ roleName, permissions });
  }
  return rolesList;
}


// ===== RBAC HELPERS =====
function getRole(username) {
  const user = getUserByUsername(username);
  return user ? user.role : null;
}

function hasPermission(username, perm) {
  const user = getUserByUsername(username);
  if (!user) return false;
  
  const permissions = PERMISSIONS[user.role];
  if (!permissions) return false;
  
  return permissions.includes(perm);
}

function isAuthorized(username, pass) {
  // Legacy password-only auth for backward compatibility
  if (String(pass) === String(LEGACY_STAFF_PASS)) return true;
  
  // RBAC auth
  const user = getUserByUsername(username);
  if (!user) return false;
  
  return String(user.password) === String(pass);
}

function isFirstTimeLogin(username) {
  const user = getUserByUsername(username);
  if (!user) return false;
  
  // Check if user has default password (indicating first time login)
  const defaultPasswords = ['SuperAdmin@10900', 'Finance@10900', 'Vinai@10900', 'Tadtel@10900'];
  return defaultPasswords.includes(String(user.password));
}

function updatePassword(username, newPassword) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameIdx = headers.indexOf('username');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][usernameIdx]).toLowerCase() === String(username).toLowerCase()) {
      sheet.getRange(i + 1, headers.indexOf('password') + 1).setValue(newPassword);
      return true;
    }
  }
  return false;
}

function requirePermission(username, perm) {
  if (!hasPermission(username, perm)) {
    throw new Error('Permission denied: ' + perm);
  }
}

function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
