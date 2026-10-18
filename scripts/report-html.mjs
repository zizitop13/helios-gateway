export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function table(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Helios Gateway</title><style>
  :root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.6;background:#101827;color:#e5eaf2}body{max-width:1100px;margin:40px auto;padding:0 24px}a{color:#93c5fd}h1{line-height:1.2}h2{margin-top:32px}p{color:#c5cfdd}table{border-collapse:collapse;width:100%;background:#192538}th,td{text-align:left;padding:10px 14px;border-bottom:1px solid #344155;vertical-align:top}th{color:#93c5fd}.table-scroll{overflow:auto}.pass{color:#86efac}.fail{color:#fda4af}pre{background:#192538;padding:18px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}li{margin:8px 0}small{color:#a6b4c8}details{margin-top:24px}</style></head><body><p><a href="https://zizitop13.github.io/helios-gateway/">Helios Gateway documentation</a></p><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}
