const fs = require('fs');
let content = fs.readFileSync('src/js/admin.js', 'utf8');

// Add printedBy info after the meta line in printReport
content = content.replace(
  `html += \`<div class="meta">พิมพ์เมื่อ \${now} · เรียงตามเลขที่อ้างอิง · จำนวน \${filtered.length} โต๊ะ</div>\`;`,
  `html += '<div class="meta">พิมพ์เมื่อ \${now} · ผู้ปริ้น: \${currentUser?.displayName || currentUser?.username || 'ไม่ระบุ'} · เรียงตามเลขที่อ้างอิง · จำนวน \${filtered.length} โต๊ะ</div>';`
);

fs.writeFileSync('src/js/admin.js', content);
console.log('Updated printReport with user info');