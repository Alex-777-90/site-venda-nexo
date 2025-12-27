// public/logistica02.js
(async function main(){
  const tableHead    = document.querySelector('#order-table1 thead'); 
  const tableBody    = document.querySelector('#order-table1 tbody');
  const lastModInfo  = document.getElementById('lastModInfo');
  const grandTotalEl = document.getElementById('grandTotal');

  const btnExport    = document.getElementById('btnExportExcel');
  const btnImport    = document.getElementById('btnImportExcel');
  const btnSave      = document.getElementById('btnSave');
  const btnClean     = document.getElementById('btnClean');
  const inpFile      = document.getElementById('fileImportExcel');
  const btnAdd       = document.getElementById('btnAddRow');   

  // Filtros
  const inpRep   = document.getElementById('representanteFilter1');
  const inpCli   = document.getElementById('clienteFilter1');
  const inpCNPJ  = document.getElementById('cnpjFilter1');
  const btnApply = document.getElementById('applyFilters1');
  const btnClear = document.getElementById('clearFilters1');

  // ===== Helpers =====
  function excelSerialToDate(n) {
    const base = new Date(Date.UTC(1899, 11, 30));
    return new Date(base.getTime() + Math.round(Number(n)) * 24 * 60 * 60 * 1000);
  }
  function dateToMMMYYYY(d) {
    const m = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const y = d.getFullYear();
    return `${m}/${y}`;
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

  const isMonthHeader = (h) => /^[A-Z]{3}\/\d{4}$/.test(String(h || ''));

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

  const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');
  const normStr    = (s) => String(s ?? '').toUpperCase();

  // Auth
  let me;
  try {
    const r = await fetch('/api/me', { credentials:'include' });
    if (!r.ok) throw new Error('not auth');
    me = (await r.json()).user; 
  } catch {
    return;
  }
  const isAdmin = me.role === 'admin';

  const ROLE_GROUPS = {
    NDR: ['NDR', 'UDR', 'NUTRIFEIRAS', 'VETFARMA', 'HF REPRESENTAÇÕES', 'RESOLPEC', 'TEC AVES', 'AGRO'],
    AGRO: ['NDR', 'UDR', 'NUTRIFEIRAS', 'VETFARMA', 'HF REPRESENTAÇÕES', 'RESOLPEC', 'TEC AVES', 'AGRO']
  };

  function canEditRow(ownerKey, myRole){
    if (!ownerKey || !myRole) return false;
    const rowKey = String(ownerKey).toUpperCase();
    const role   = String(myRole).toUpperCase();
    if (role === 'ADMIN') return true; 
    const group = ROLE_GROUPS[role];
    if (group) return group.includes(rowKey);
    return rowKey === role;
  }

  // Meta
  const meta = await fetch('/api/meta', { credentials:'include' }).then(r=>r.json()).then(j=>j.meta);
  const headers = meta?.headers || [];           
  const nonEditable = meta?.nonEditable || [];
  const canEditCol = (name) => !nonEditable.includes(name);

  // Define colunas
  const usuarioIndex = headers.findIndex(h => h === 'Usuario'); 
  const displayCols = [];  
  headers.forEach((h, idx) => {
    if (idx === usuarioIndex) {
      displayCols.push({ kind: 'total' });
    }
    displayCols.push({ kind: 'data', key: h });
  });
  if (usuarioIndex === -1) displayCols.push({ kind: 'total' });

  // Botões
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

  async function loadRows() {
    const r = await fetch('/api/rows', { credentials:'include' });
    const js = await r.json();
    return js.rows || [];
  }

  let allRows = [];
  const pending = new Map();
  const newRows = []; 

  function applyFilters(rows) {
    const rep  = normStr(inpRep.value.trim());
    const cli  = normStr(inpCli.value.trim());
    const cnpj = onlyDigits(inpCNPJ.value.trim());

    return rows.filter(r => {
      const data = r.data || {};
      if (rep) {
        const usuario = normStr(data['Usuario']);
        if (!usuario.includes(rep)) return false;
      }
      if (cli) {
        const cliente = normStr(data['Cliente']);
        if (!cliente.includes(cli)) return false;
      }
      if (cnpj) {
        const pnDigits = onlyDigits(data['Código do PN']);
        if (!pnDigits.includes(cnpj)) return false;
      }
      return true;
    });
  }

  async function render() {
    if (allRows.length === 0) {
      allRows = await loadRows();
    }

    const rows = applyFilters(allRows);

    // ==========================================
    // CÁLCULO DE TOTAIS
    // ==========================================
    const colSums = {}; 
    let grandTotalSum = 0;

    displayCols.forEach(colDef => {
      if (colDef.kind === 'data') colSums[colDef.key] = 0;
      if (colDef.kind === 'total') colSums['__GENERATED_TOTAL__'] = 0;
    });

    rows.forEach(r => {
      let rowTotal = 0;
      displayCols.forEach(colDef => {
        if (colDef.kind === 'data') {
          const h = colDef.key;
          const label = maskHeaderToMMMYYYY(h);
          if (isMonthHeader(label)) {
            const val = parseToNumber(String(r.data[h]));
            if (val && Number.isFinite(val)) {
              colSums[h] += val;
              rowTotal += val;
            }
          }
        }
      });
      colSums['__GENERATED_TOTAL__'] += rowTotal;
    });
    grandTotalSum = colSums['__GENERATED_TOTAL__'];

    // ==========================================
    // RENDERIZAR CABEÇALHO (2 LINHAS)
    // ==========================================
    tableHead.innerHTML = ''; 

    // 1. Linha de Títulos
    const trTitle = document.createElement('tr');
    trTitle.classList.add('header-row-titles'); // <--- CLASSE IMPORTANTE PARA O CSS

    // 2. Linha de Totais
    const trTotal = document.createElement('tr');
    trTotal.classList.add('header-row-totals');

    for (const colDef of displayCols) {
      const thTitle = document.createElement('th');
      const thTotal = document.createElement('th');
      
      if (colDef.kind === 'total') {
        thTitle.textContent = 'Total';
        thTitle.classList.add('col-month', 'col-total');
        
        thTotal.classList.add('col-month', 'col-total');
        thTotal.textContent = fmtBRL(colSums['__GENERATED_TOTAL__']);
      } else {
        const h = colDef.key;
        const label = maskHeaderToMMMYYYY(h);
        thTitle.textContent = label;
        
        if (isMonthHeader(label)) {
          thTitle.classList.add('col-month');
          thTotal.classList.add('col-month');
          thTotal.textContent = fmtBRL(colSums[h]);
        } else {
          thTotal.textContent = '';
        }
      }
      trTitle.appendChild(thTitle);
      trTotal.appendChild(thTotal);
    }

    const thDateTitle = document.createElement('th');
    thDateTitle.textContent = 'Data Modificação';
    trTitle.appendChild(thDateTitle);

    const thDateTotal = document.createElement('th');
    thDateTotal.textContent = '';
    trTotal.appendChild(thDateTotal);

    tableHead.appendChild(trTitle);
    tableHead.appendChild(trTotal);

    // ==========================================
    // ATUALIZA INFO E CORPO
    // ==========================================
    if (grandTotalEl) {
       grandTotalEl.textContent = 'Total geral: ' + fmtBRL(grandTotalSum);
    }

    const universe = isAdmin ? rows : rows.filter(r => canEditRow(r.ownerKey, me.role));
    const last = universe.reduce((acc, r) => !acc || new Date(r.modifiedAt) > new Date(acc.modifiedAt) ? r : acc, null);
    lastModInfo.textContent = last
      ? `${isAdmin ? 'Última modificação' : 'Sua última modificação'}: ${new Date(last.modifiedAt).toLocaleString('pt-BR')} ${last.modifiedBy ? 'por ' + last.modifiedBy : ''}`
      : '';

    tableBody.innerHTML = '';

    for (const row of rows) {
      const tr = document.createElement('tr');
      let runningTotal = 0;           
      const monthInputs = [];         
      let tdTotal = null;             

      for (const colDef of displayCols) {
        if (colDef.kind === 'total') {
          tdTotal = document.createElement('td');
          tdTotal.classList.add('col-total', 'col-month');
          tdTotal.textContent = runningTotal ? fmtBRL(runningTotal) : '';
          tr.appendChild(tdTotal);
          continue;
        }

        const col = colDef.key;
        const td  = document.createElement('td');
        const val = row.data?.[col] ?? '';
        const label = maskHeaderToMMMYYYY(col);
        const ehMes = isMonthHeader(label);
        if (ehMes) td.classList.add('col-month');

        if (ehMes) {
          const nVal = (typeof val === 'number') ? val : parseToNumber(String(val));
          if (nVal !== '' && Number.isFinite(nVal)) {
            runningTotal += nVal;
          }
        }

        const podeEditar = canEditCol(col) && (isAdmin || canEditRow(row.ownerKey, me.role));

        if (podeEditar) {
          const input = document.createElement('input');
          input.type = 'text';
          const looksNumeric = typeof val === 'number' || /^[R$ .,\d-]+$/.test(String(val || ''));
          input.value = looksNumeric ? fmtBRL(val) : String(val);

          if (!ehMes) input.style.width = '120px';
          if (ehMes) monthInputs.push(input);

          input.addEventListener('input', () => {
            const patch = pending.get(row._id) || {};
            patch[col] = looksNumeric ? parseToNumber(input.value) : input.value;
            pending.set(row._id, patch);
            btnSave.style.opacity = '1';
          });
          td.appendChild(input);
        } else {
          td.textContent = typeof val === 'number' ? fmtBRL(val) : (val ?? '');
        }
        tr.appendChild(td);
      }

      if (tdTotal && monthInputs.length > 0) {
        const recalcTotal = () => {
          let sum = 0;
          monthInputs.forEach(inp => {
            const n = parseToNumber(inp.value);
            if (n !== '' && Number.isFinite(n)) sum += n;
          });
          tdTotal.textContent = sum ? fmtBRL(sum) : '';
        };
        recalcTotal();
        monthInputs.forEach(inp => inp.addEventListener('input', recalcTotal));
      }

      const tdDate = document.createElement('td');
      tdDate.textContent = row.modifiedAt ? new Date(row.modifiedAt).toLocaleString('pt-BR') : '';
      tr.appendChild(tdDate);

      tableBody.appendChild(tr);
    }

    newRows.forEach(nr => tableBody.appendChild(nr.tr));
  }

  // Adicionar linha
  btnAdd?.addEventListener('click', () => {
    const tr = document.createElement('tr');
    const rowObj = { inputs: {}, tr };
    headers.forEach(h => {
      const td = document.createElement('td');
      const label = maskHeaderToMMMYYYY(h);
      const ehMes = isMonthHeader(label);
      if (ehMes) td.classList.add('col-month');
      const input = document.createElement('input');
      input.type = 'text';
      if (!ehMes) input.style.width = '120px';
      input.placeholder = '';
      rowObj.inputs[h] = input;
      td.appendChild(input);
      tr.appendChild(td);
    });
    const tdTotal = document.createElement('td');
    tdTotal.classList.add('col-total', 'col-month');
    tdTotal.textContent = '';
    tr.appendChild(tdTotal);
    const tdDate = document.createElement('td');
    tdDate.textContent = '';
    tr.appendChild(tdDate);
    tableBody.appendChild(tr);
    newRows.push(rowObj);
    btnSave.style.opacity = '1';
  });

  // Salvar
  btnSave.addEventListener('click', async () => {
    if (pending.size === 0 && newRows.length === 0) return alert('Não há alterações para salvar.');
    btnSave.style.pointerEvents = 'none';
    btnSave.style.opacity = '0.5';
    try {
      const promises = [];
      for (const [id, patch] of pending.entries()) {
        promises.push(fetch(`/api/rows/${id}`, {
          method: 'PUT', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(patch)
        }));
      }
      for (const nr of newRows) {
        const data = {};
        for (const h of headers) {
          const val = nr.inputs[h].value;
          const label = maskHeaderToMMMYYYY(h);
          const ehMes = isMonthHeader(label);
          if (ehMes) {
            const num = parseToNumber(val);
            data[h] = (num === '' ? null : num);
          } else {
            const maybeNum = parseToNumber(val);
            data[h] = (maybeNum === '' ? (val || null) : maybeNum);
          }
        }
        if (!('Usuario' in data) || !data['Usuario']) { data['Usuario'] = (me.role || '').toUpperCase(); }
        promises.push(fetch('/api/rows', {
          method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify({ data })
        }));
      }
      const resps = await Promise.all(promises);
      const ok = resps.every(r => r.ok);
      if (!ok) alert('Algumas alterações não foram salvas.');
      else alert('Alterações salvas!');
      pending.clear();
      newRows.length = 0;
      allRows = [];
      await render();
    } finally {
      btnSave.style.pointerEvents = '';
      btnSave.style.opacity = '';
    }
  });

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

  btnApply.addEventListener('click', () => render());
  btnClear.addEventListener('click', () => {
    inpRep.value = '';
    inpCli.value = '';
    inpCNPJ.value = '';
    render();
  });
  [inpRep, inpCli, inpCNPJ].forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') render(); });
  });

  await render();
})();