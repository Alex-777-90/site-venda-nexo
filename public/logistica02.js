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

  // Filtros
  const inpRep   = document.getElementById('representanteFilter1');
  const inpCli   = document.getElementById('clienteFilter1');
  const inpCNPJ  = document.getElementById('cnpjFilter1');
  const btnApply = document.getElementById('applyFilters1');
  const btnClear = document.getElementById('clearFilters1');

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

  // coluna é "mês" se o rótulo final for MMM/AAAA (ex.: NOV/2025)
  const isMonthHeader = (h) => /^[A-Z]{3}\/\d{4}$/.test(String(h || ''));

  // ===== Helpers numéricos (sem “R$”) =====
  function fmtBRL(val) {
    if (val === null || val === undefined || val === '') return '';
    const num = +String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    if (Number.isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }
  function parseToNumber(text){
    if (!text) return '';
    const clean = text
      .replace(/[^\d,-]/g,'')
      .replace(/\.(?=\d{3})/g,'')
      .replace(',','.');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : '';
  }

  // Helpers de filtros
  const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');
  const normStr    = (s) => String(s ?? '').toUpperCase();

  // 1) quem sou eu?
  let me;
  try {
    const r = await fetch('/api/me', { credentials:'include' });
    if (!r.ok) throw new Error('not auth');
    me = (await r.json()).user; // {email, role, name}
  } catch {
    return;
  }
  const isAdmin = me.role === 'admin';

  // 2) meta (headers dinâmicos)
  const meta = await fetch('/api/meta', { credentials:'include' }).then(r=>r.json()).then(j=>j.meta);
  const headers = meta?.headers || [];
  const nonEditable = meta?.nonEditable || [];
  const canEditCol = (name) => !nonEditable.includes(name);

  // 3) thead dinâmico com máscara "MMM/YYYY" e marcação de mês
  tableHeadRow.innerHTML = '';
  for (const h of headers) {
    const th = document.createElement('th');
    const label = maskHeaderToMMMYYYY(h);
    th.textContent = label;
    if (isMonthHeader(label)) th.classList.add('col-month'); // marca colunas de mês
    tableHeadRow.appendChild(th);
  }
  // coluna extra: data modificação
  const thDate = document.createElement('th');
  thDate.textContent = 'Data Modificação';
  tableHeadRow.appendChild(thDate);

  // 4) botões/visibilidade por role
  btnExport.style.display = isAdmin ? '' : 'none';
  btnImport.style.display = isAdmin ? '' : 'none';
  btnClean.style.display  = isAdmin ? '' : 'none';

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

  // 5) carregar linhas (em memória para filtros locais)
  async function loadRows() {
    const r = await fetch('/api/rows', { credentials:'include' });
    const js = await r.json();
    return js.rows || [];
  }

  let allRows = [];
  const pending = new Map();

  function applyFilters(rows) {
    const rep  = normStr(inpRep.value.trim());
    const cli  = normStr(inpCli.value.trim());
    const cnpj = onlyDigits(inpCNPJ.value.trim());

    return rows.filter(r => {
      const data = r.data || {};

      // Representante -> coluna "Usuario"
      if (rep) {
        const usuario = normStr(data['Usuario']);
        if (!usuario.includes(rep)) return false;
      }

      // Cliente -> coluna "Cliente"
      if (cli) {
        const cliente = normStr(data['Cliente']);
        if (!cliente.includes(cli)) return false;
      }

      // CNPJ -> coluna "Código do PN" (ex.: C4598537... -> comparamos apenas dígitos)
      if (cnpj) {
        const pnDigits = onlyDigits(data['Código do PN']);
        if (!pnDigits.includes(cnpj)) return false; // troque p/ startsWith se quiser
      }

      return true;
    });
  }

  async function render() {
    if (allRows.length === 0) {
      allRows = await loadRows();
    }

    const rows = applyFilters(allRows);

    // Badge última modificação
    const universe = isAdmin ? rows : rows.filter(r => (r.ownerKey||'').toUpperCase() === me.role.toUpperCase());
    const last = universe.reduce((acc, r) => !acc || new Date(r.modifiedAt) > new Date(acc.modifiedAt) ? r : acc, null);
    lastModInfo.textContent = last
      ? `${isAdmin ? 'Última modificação' : 'Sua última modificação'}: ${new Date(last.modifiedAt).toLocaleString('pt-BR')} ${last.modifiedBy ? 'por ' + last.modifiedBy : ''}`
      : '';

    tableBody.innerHTML = '';

    for (const row of rows) {
      const tr = document.createElement('tr');

      for (const col of headers) {
        const td  = document.createElement('td');
        const val = row.data?.[col] ?? '';

        // rótulo "mascarado" para checar se é mês
        const label = maskHeaderToMMMYYYY(col);
        const ehMes = isMonthHeader(label);
        if (ehMes) td.classList.add('col-month');

        const podeEditar = canEditCol(col) &&
                           (isAdmin || row.ownerKey?.toUpperCase() === me.role.toUpperCase());

        if (podeEditar) {
          const input = document.createElement('input');
          input.type = 'text';
          const looksNumeric = typeof val === 'number' || /^[R$ .,\d-]+$/.test(String(val || ''));
          input.value = looksNumeric ? fmtBRL(val) : String(val);

          // largura inline apenas para colunas NÃO-mês
          if (!ehMes) input.style.width = '120px';

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

      const tdDate = document.createElement('td');
      tdDate.textContent = row.modifiedAt ? new Date(row.modifiedAt).toLocaleString('pt-BR') : '';
      tr.appendChild(tdDate);

      tableBody.appendChild(tr);
    }
  }

  // salvar pendências
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
      allRows = []; // força recarregar do server para pegar modifiedAt/by atualizados
      await render();
    } finally {
      btnSave.style.pointerEvents = '';
      btnSave.style.opacity = '';
    }
  });

  // limpar dados (admin)
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

  // ligar filtros
  btnApply.addEventListener('click', () => render());
  btnClear.addEventListener('click', () => {
    inpRep.value = '';
    inpCli.value = '';
    inpCNPJ.value = '';
    render();
  });

  // Enter aplica
  [inpRep, inpCli, inpCNPJ].forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') render(); });
  });

  await render();
})();
