// public/logistica02.js
(async function main(){
  const tableHeadRow = document.querySelector('#order-table1 thead tr');
  const tableBody    = document.querySelector('#order-table1 tbody');
  const lastModInfo  = document.getElementById('lastModInfo');
  const grandTotalEl = document.getElementById('grandTotal');

  const btnExport    = document.getElementById('btnExportExcel');
  const btnImport    = document.getElementById('btnImportExcel');
  const btnSave      = document.getElementById('btnSave');
  const btnClean     = document.getElementById('btnClean');
  const inpFile      = document.getElementById('fileImportExcel');
  const btnAdd       = document.getElementById('btnAddRow');   // botão “Adicionar linha”

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

  // ===== grupos de acesso por papel (tem que bater com o back) =====
  const ROLE_GROUPS = {
    NDR: [
      'NDR', 'UDR', 'NUTRIFEIRAS', 'VETFARMA',
      'HF REPRESENTAÇÕES', 'RESOLPEC', 'TEC AVES', 'AGRO'
    ],
    AGRO: [
      'NDR', 'UDR', 'NUTRIFEIRAS', 'VETFARMA',
      'HF REPRESENTAÇÕES', 'RESOLPEC', 'TEC AVES', 'AGRO'
    ]
    // demais roles (P7, NETCOLLOR etc.) seguem a regra “só edita o próprio ownerKey”
  };

  function canEditRow(ownerKey, myRole){
    if (!ownerKey || !myRole) return false;
    const rowKey = String(ownerKey).toUpperCase();
    const role   = String(myRole).toUpperCase();

    if (role === 'ADMIN') return true; // segurança extra

    const group = ROLE_GROUPS[role];
    if (group) return group.includes(rowKey);

    // padrão: só edita se for exatamente o mesmo ownerKey
    return rowKey === role;
  }

  // 2) meta (headers dinâmicos)
  const meta = await fetch('/api/meta', { credentials:'include' }).then(r=>r.json()).then(j=>j.meta);
  const headers = meta?.headers || [];           // headers reais (banco)
  const nonEditable = meta?.nonEditable || [];
  const canEditCol = (name) => !nonEditable.includes(name);

  // ===== estrutura para incluir coluna TOTAL na visualização =====
  const usuarioIndex = headers.findIndex(h => h === 'Usuario'); // normalmente é o último
  const displayCols = [];  // ordem das colunas na TABELA (inclui "TOTAL")
  const monthHeaders = []; // nomes das colunas que são meses

  headers.forEach((h, idx) => {
    // Antes de "Usuario" colocamos a coluna TOTAL
    if (idx === usuarioIndex) {
      displayCols.push({ kind: 'total' });
    }

    displayCols.push({ kind: 'data', key: h });

    const label = maskHeaderToMMMYYYY(h);
    if (isMonthHeader(label)) {
      monthHeaders.push(h);
    }
  });

  // Se por algum motivo não existir "Usuario", põe TOTAL no fim
  if (usuarioIndex === -1) {
    displayCols.push({ kind: 'total' });
  }

  // 3) thead dinâmico com máscara "MMM/YYYY" + coluna TOTAL + Data Modificação
  tableHeadRow.innerHTML = '';

  for (const colDef of displayCols) {
    const th = document.createElement('th');

    if (colDef.kind === 'total') {
      th.textContent = 'Total';
      th.classList.add('col-month', 'col-total'); // numérica, estilo parecido com meses
    } else {
      const h = colDef.key;
      const label = maskHeaderToMMMYYYY(h);
      th.textContent = label;
      if (isMonthHeader(label)) th.classList.add('col-month');
    }

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

  // linhas recém-criadas (sem _id ainda)
  const newRows = []; // cada item = { inputs:{header:input}, tr:<tr> }

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
        if (!pnDigits.includes(cnpj)) return false;
      }

      return true;
    });
  }

  // ===== TOTAL GERAL (soma da coluna Total visível) =====
  function updateGrandTotal() {
    if (!grandTotalEl) return;
    let sum = 0;
    document.querySelectorAll('#order-table1 tbody td.col-total').forEach(td => {
      const n = parseToNumber(td.textContent);
      if (n !== '' && Number.isFinite(n)) sum += n;
    });
    grandTotalEl.textContent =
      'Total geral: ' + (sum ? fmtBRL(sum) : '0');
  }

  async function render() {
    if (allRows.length === 0) {
      allRows = await loadRows();
    }

    const rows = applyFilters(allRows);

    // Badge última modificação
    const universe = isAdmin
      ? rows
      : rows.filter(r => canEditRow(r.ownerKey, me.role));

    const last = universe.reduce(
      (acc, r) =>
        !acc || new Date(r.modifiedAt) > new Date(acc.modifiedAt) ? r : acc,
      null
    );

    lastModInfo.textContent = last
      ? `${isAdmin ? 'Última modificação' : 'Sua última modificação'}: ${new Date(last.modifiedAt).toLocaleString('pt-BR')} ${last.modifiedBy ? 'por ' + last.modifiedBy : ''}`
      : '';

    tableBody.innerHTML = '';

    for (const row of rows) {
      const tr = document.createElement('tr');

      let runningTotal = 0;           // soma das colunas de mês
      const monthInputs = [];         // inputs de mês dessa linha (para recálculo ao digitar)
      let tdTotal = null;             // célula da coluna TOTAL (texto, não editável)

      for (const colDef of displayCols) {

        // ===== COLUNA TOTAL (sintética, não existe no banco) =====
        if (colDef.kind === 'total') {
          tdTotal = document.createElement('td');
          tdTotal.classList.add('col-total', 'col-month');
          tdTotal.textContent = runningTotal ? fmtBRL(runningTotal) : '';
          tr.appendChild(tdTotal);
          continue;
        }

        // ===== COLUNAS REAIS (vindas do banco) =====
        const col = colDef.key;
        const td  = document.createElement('td');
        const val = row.data?.[col] ?? '';

        const label = maskHeaderToMMMYYYY(col);
        const ehMes = isMonthHeader(label);
        if (ehMes) td.classList.add('col-month');

        // acumula TOTAL a partir das colunas de mês
        if (ehMes) {
          const nVal = (typeof val === 'number') ? val : parseToNumber(String(val));
          if (nVal !== '' && Number.isFinite(nVal)) {
            runningTotal += nVal;
          }
        }

        const podeEditar =
          canEditCol(col) &&
          (isAdmin || canEditRow(row.ownerKey, me.role));

        if (podeEditar) {
          const input = document.createElement('input');
          input.type = 'text';
          const looksNumeric =
            typeof val === 'number' || /^[R$ .,\d-]+$/.test(String(val || ''));
          input.value = looksNumeric ? fmtBRL(val) : String(val);

          // largura inline apenas para colunas NÃO-mês
          if (!ehMes) input.style.width = '120px';

          // se for coluna de mês, guarda para recalcular TOTAL depois
          if (ehMes) monthInputs.push(input);

          input.addEventListener('input', () => {
            const patch = pending.get(row._id) || {};
            patch[col] = looksNumeric ? parseToNumber(input.value) : input.value;
            pending.set(row._id, patch);
            btnSave.style.opacity = '1';
          });

          td.appendChild(input);
        } else {
          td.textContent =
            typeof val === 'number' ? fmtBRL(val) : (val ?? '');
        }
        tr.appendChild(td);
      }

      // Depois de criar todas as células reais + TOTAL,
      // liga o recálculo de TOTAL quando editar os meses
      if (tdTotal && monthInputs.length > 0) {
        const recalcTotal = () => {
          let sum = 0;
          monthInputs.forEach(inp => {
            const n = parseToNumber(inp.value);
            if (n !== '' && Number.isFinite(n)) sum += n;
          });
          tdTotal.textContent = sum ? fmtBRL(sum) : '';
          updateGrandTotal();
        };
        // recálculo inicial (caso os meses tenham valor)
        recalcTotal();
        // recálculo toda vez que digitar num mês
        monthInputs.forEach(inp => inp.addEventListener('input', recalcTotal));
      }

      // coluna Data Modificação
      const tdDate = document.createElement('td');
      tdDate.textContent = row.modifiedAt
        ? new Date(row.modifiedAt).toLocaleString('pt-BR')
        : '';
      tr.appendChild(tdDate);

      tableBody.appendChild(tr);
    }

    // Reanexa as linhas novas (caso já tenham sido criadas antes de um novo render)
    newRows.forEach(nr => tableBody.appendChild(nr.tr));

    // Atualiza o total geral com base no que está visível
    updateGrandTotal();
  }

  // ===== Adicionar linha =====
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

    // coluna "Total" da linha nova (somente visual – calculada depois de salvar)
    const tdTotal = document.createElement('td');
    tdTotal.classList.add('col-total', 'col-month');
    tdTotal.textContent = '';
    tr.appendChild(tdTotal);

    // coluna "Data Modificação" (apenas visual – vazia até salvar)
    const tdDate = document.createElement('td');
    tdDate.textContent = '';
    tr.appendChild(tdDate);

    tableBody.appendChild(tr);
    newRows.push(rowObj);

    // destaca que há algo para salvar
    btnSave.style.opacity = '1';
  });

  // salvar pendências (PUT) + novas (POST)
  btnSave.addEventListener('click', async () => {
    if (pending.size === 0 && newRows.length === 0)
      return alert('Não há alterações para salvar.');

    btnSave.style.pointerEvents = 'none';
    btnSave.style.opacity = '0.5';

    try {
      const promises = [];

      // 1) atualizações (PUT) já existentes
      for (const [id, patch] of pending.entries()) {
        promises.push(fetch(`/api/rows/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch)
        }));
      }

      // 2) inclusões (POST /api/rows)
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

        // se o usuário não preencher "Usuario", define com o papel do login
        if (!('Usuario' in data) || !data['Usuario']) {
          data['Usuario'] = (me.role || '').toUpperCase();
        }

        promises.push(fetch('/api/rows', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          credentials: 'include',
          body: JSON.stringify({ data })
        }));
      }

      const resps = await Promise.all(promises);
      const ok = resps.every(r => r.ok);
      if (!ok) alert('Algumas alterações não foram salvas.');
      else alert('Alterações salvas!');

      // limpa estados e recarrega para pegar _id/modifiedAt/modifiedBy atualizados
      pending.clear();
      newRows.length = 0;
      allRows = [];
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
