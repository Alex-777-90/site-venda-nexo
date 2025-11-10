// public/logistica02.js
(async function main(){
  const tableHeadRow = document.querySelector('#order-table1 thead tr');
  const tableBody    = document.querySelector('#order-table1 tbody');
  const lastModInfo  = document.getElementById('lastModInfo');

  const btnExport    = document.getElementById('btnExportExcel');
  const btnImport    = document.getElementById('btnImportExcel');
  const btnSave      = document.getElementById('btnSave');
  const btnClean     = document.getElementById('btnClean');
  const inpFile      = document.getElementById('fileImportExcel');

  // ===== Helpers de data para o cabeçalho =====
  function excelSerialToDate(n) {
    const base = new Date(Date.UTC(1899, 11, 30));
    return new Date(base.getTime() + Math.round(Number(n)) * 24 * 60 * 60 * 1000);
  }
  function dateToMMMYYYY(d) {
    const m = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const y = d.getFullYear();
    return `${m}/${y}`; // ex.: NOV/2025
  }
  function maskHeaderToMMMYYYY(h) {
    // Já está no formato desejado?
    if (typeof h === 'string' && /^[A-Z]{3}\/\d{4}$/.test(h)) return h;

    if (typeof h === 'string') {
      const parsed = Date.parse(h);
      if (!isNaN(parsed)) return dateToMMMYYYY(new Date(parsed));
      if (!isNaN(+h))      return dateToMMMYYYY(excelSerialToDate(+h));
      return h;
    }
    if (typeof h === 'number' && Number.isFinite(h)) return dateToMMMYYYY(excelSerialToDate(h));
    if (h instanceof Date && !isNaN(h.valueOf()))    return dateToMMMYYYY(h);
    return String(h ?? '');
  }

  // ===== Helpers de moeda =====
  function fmtBRL(val){
    if (val === null || val === undefined || val === '') return '';
    const num = +String(val).replace(/[^\d,-]/g,'').replace(',','.');
    if (Number.isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR',{ style:'currency', currency:'BRL' });
  }
  function parseToNumber(text){
    if (!text) return '';
    const clean = text.replace(/[^\d,-]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : '';
  }

  // 1) quem sou eu?
  let me;
  try {
    const r = await fetch('/api/me', { credentials:'include' });
    if (!r.ok) throw new Error('not auth');
    me = (await r.json()).user; // {email, role, name}
  } catch {
    return; // o server já trata redirecionamento
  }
  const isAdmin = me.role === 'admin';

  // 2) meta (headers dinâmicos)
  const meta = await fetch('/api/meta', { credentials:'include' }).then(r=>r.json()).then(j=>j.meta);
  const headers = meta?.headers || [];
  const nonEditable = meta?.nonEditable || [];
  const canEditCol = (name) => !nonEditable.includes(name);

  // 3) thead dinâmico com máscara "MMM/YYYY"
  tableHeadRow.innerHTML = '';
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = maskHeaderToMMMYYYY(h);
    tableHeadRow.appendChild(th);
  }
  // --- nova coluna no cabeçalho ---
  const thDate = document.createElement('th');
  thDate.textContent = 'Data Modificação';
  tableHeadRow.appendChild(thDate);

  // 4) botões/visibilidade por role
  btnExport.style.display = isAdmin ? '' : 'none';
  btnImport.style.display = isAdmin ? '' : 'none';
  btnClean.style.display  = isAdmin ? '' : 'none';

  // Import/Export
  btnExport?.addEventListener('click', () => window.location.href = '/api/export.xlsx');
  btnImport?.addEventListener('click', () => inpFile.click());
  inpFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/import', { method:'POST', body:fd, credentials:'include' });
    const js  = await res.json().catch(()=>({}));
    if (!res.ok) return alert('Falha ao importar: ' + (js.error || res.status));
    alert('Importado com sucesso!');
    location.reload();
  });

  // 5) carregar linhas
  async function loadRows() {
    const r = await fetch('/api/rows', { credentials:'include' });
    const js = await r.json();
    return js.rows || [];
  }

  // ---- Buffer de alterações (idDaLinha -> {col:valor,...})
  const pending = new Map();

  async function render() {
    const rows = await loadRows();

    // Badge de última modificação
    if (isAdmin) {
      const last = rows.reduce((acc,r)=> !acc || new Date(r.modifiedAt) > new Date(acc.modifiedAt) ? r : acc, null);
      lastModInfo.textContent = last ? `Última modificação: ${new Date(last.modifiedAt).toLocaleString('pt-BR')} por ${last.modifiedBy || '—'}` : '';
    } else {
      const mine = rows.filter(r => (r.ownerKey||'').toUpperCase() === me.role.toUpperCase());
      const last = mine.reduce((acc,r)=> !acc || new Date(r.modifiedAt) > new Date(acc.modifiedAt) ? r : acc, null);
      lastModInfo.textContent = last ? `Sua última modificação: ${new Date(last.modifiedAt).toLocaleString('pt-BR')}` : '';
    }

    tableBody.innerHTML = '';

    for (const row of rows) {
      const tr = document.createElement('tr');

      for (const col of headers) {
        const td  = document.createElement('td');
        const val = row.data?.[col] ?? '';

        const podeEditar = canEditCol(col) &&
                           (isAdmin || row.ownerKey?.toUpperCase() === me.role.toUpperCase());

        if (podeEditar) {
          const input = document.createElement('input');
          input.type = 'text';
          const looksNumeric = typeof val === 'number' || /^[R$ .,\d-]+$/.test(String(val || ''));
          input.value = looksNumeric ? fmtBRL(val) : String(val);
          input.style.width = '120px';

          input.addEventListener('input', () => {
            const patch = pending.get(row._id) || {};
            patch[col] = looksNumeric ? parseToNumber(input.value) : input.value;
            pending.set(row._id, patch);
            btnSave.style.opacity = '1';
          });

          td.appendChild(input);
        } else {
          td.textContent = (typeof val === 'number') ? fmtBRL(val) : (val ?? '');
        }
        tr.appendChild(td);
      }

      // --- nova célula com a data de modificação ---
      const tdDate = document.createElement('td');
      tdDate.textContent = row.modifiedAt
        ? new Date(row.modifiedAt).toLocaleString('pt-BR')
        : '';
      tr.appendChild(tdDate);

      tableBody.appendChild(tr);
    }
  }

  // 6) Salvar pendências (várias linhas)
  btnSave.addEventListener('click', async () => {
    if (pending.size === 0) return alert('Não há alterações para salvar.');

    btnSave.style.pointerEvents = 'none';
    btnSave.style.opacity = '0.5';

    try {
      const saves = [];
      for (const [id, patch] of pending.entries()) {
        saves.push(fetch(`/api/rows/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch)
        }));
      }
      const resps = await Promise.all(saves);
      const ok = resps.every(r => r.ok);
      if (!ok) alert('Algumas linhas não foram salvas.');
      else alert('Alterações salvas!');
      pending.clear();
      await render();
    } finally {
      btnSave.style.pointerEvents = '';
      btnSave.style.opacity = '';
    }
  });

  // 7) Limpar dados (admin) -> apaga TODAS as linhas
  btnClean.addEventListener('click', async () => {
    if (!isAdmin) return;
    if (!confirm('Tem certeza que deseja APAGAR TODAS as linhas da tabela?')) return;
    btnClean.style.pointerEvents = 'none';
    btnClean.style.opacity = '0.5';
    const r = await fetch('/api/clean', { method:'POST', credentials:'include' });
    const js = await r.json().catch(()=>({}));
    if (!r.ok) alert('Falha ao limpar: ' + (js.error || r.status));
    else alert(`Tabela apagada (${js.deleted} linhas).`);
    btnClean.style.pointerEvents = '';
    btnClean.style.opacity = '';
    location.reload();
  });

  await render();
})();
