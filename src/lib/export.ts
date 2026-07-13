interface ExportColumn {
  header: string;
  key: string;
}

export function exportToCSV(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n');
  const csv = '\uFEFF' + header + '\n' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToExcel(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  const header = `<tr>${columns.map((c) => `<th style="background:#f0f0f0;font-weight:bold;text-align:left;padding:6px;">${escape(c.header)}</th>`).join('')}</tr>`;
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td style="padding:6px;border:1px solid #ddd;">${escape(row[c.key])}</td>`).join('')}</tr>`)
    .join('');
  const table = `<table border="1" cellspacing="0">${header}${body}</table>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${table}</body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${filename}.xls`);
}

export function exportToPDF(_filename: string, title: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const escape = (val: unknown) => String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const header = columns.map((c) => `<th style="background:#10b981;color:#fff;padding:8px;text-align:left;font-size:11px;">${escape(c.header)}</th>`).join('');
  const body = rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'};">${columns.map((c) => `<td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;">${escape(row[c.key])}</td>`).join('')}</tr>`
    )
    .join('');
  const table = `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;">${header}${body}</table>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;}h1{color:#10b981;font-size:18px;}</style></head><body><h1>${escape(title)}</h1><p style="font-size:11px;color:#666;">Dicetak: ${new Date().toLocaleString('id-ID')}</p>${table}</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
