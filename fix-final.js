const fs = require('fs');
let content = fs.readFileSync('src/js/admin.js', 'utf8');

// Replace the old renderTable filter with role-based filtering
const oldFilter = `let rows = allRows.filter(r => {
    if (!r.ref || String(r.ref).trim() === '') return false;
    if (fs && r.status !== fs) return false;
    if (fd && r.visitDate !== fd) return false;
    if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
    return true;
  });`;

const newFilter = `let rows = allRows.filter(r => {
    if (!r.ref || String(r.ref).trim() === '') return false;
    // Role-based status filtering
    const roleAllowedStatuses = {
      Vinai: ['รอตรวจสอบวินัย'],
      Finance: ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'],
      Tadtel: ['รอตรวจสอบผู้เข้าร่วม']
    };
    const allowed = roleAllowedStatuses[currentUser?.role];
    if (allowed && !allowed.includes(r.status)) return false;
    if (fd && r.visitDate !== fd) return false;
    if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
    return true;
  });`;

if (content.includes(oldFilter)) {
  content = content.replace(oldFilter, newFilter);
  fs.writeFileSync('src/js/admin.js', content);
  console.log('Role-based filtering added');
} else {
  console.log('Pattern not found - may already be updated or different format');
}