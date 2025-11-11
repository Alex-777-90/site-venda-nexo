// router/dataRouter.js
const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const Row     = require('../models/Row');
const SheetMeta = require('../models/SheetMeta');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});


// Colunas invariavelmente NÃO editáveis (as da esquerda)
const BASE_NON_EDITABLE = [
  'Código do PN', 'Nome do PN', 'Cliente', 'Tipo Venda', 'Fabricante', 'Código', 'Produto',
  'Usuario', 'modificação'
];

/* =========================
   Helpers para cabeçalhos
   ========================= */

// Converte número de série do Excel para Date (UTC)
function excelSerialToDate(n) {
  const base = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
  return new Date(base.getTime() + Math.round(Number(n)) * 24 * 60 * 60 * 1000);
}

// Formata Date -> "MMM/YYYY" em PT-BR (maiúsculo, sem ponto)
function dateToMMMYYYY(d) {
  const m = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const y = d.getFullYear();
  return `${m}/${y}`; // ex.: NOV/2025
}

// Normaliza um header do Excel para string amigável e consistente
function norm(h) {
  // 1) serial numérico
  if (typeof h === 'number' && Number.isFinite(h)) {
    return dateToMMMYYYY(excelSerialToDate(h));
  }
  // 2) objeto Date
  if (h instanceof Date && !isNaN(h.valueOf())) {
    return dateToMMMYYYY(h);
  }
  // 3) string que representa data
  if (typeof h === 'string') {
    const parsed = Date.parse(h);
    if (!isNaN(parsed)) return dateToMMMYYYY(new Date(parsed));
    return h.trim();
  }
  return String(h ?? '').trim();
}

/* =========================
   Rotas
   ========================= */

// ---------- IMPORTAR (ADMIN) ----------
router.post('/api/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok:false, error:'FILE_REQUIRED' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellText: true, cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // 1) headers originais -> normalizados (ordem preservada)
    const headerRow = XLSX.utils.sheet_to_json(ws, { header:1 })[0] || [];
    const headers = headerRow.map(norm);

    // 2) ler linhas usando os headers normalizados (garante nomes corretos)
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: headers,  // usa exatamente estes nomes
      range: 1,         // pula a 1ª linha (headers)
      defval: null,
      raw: false
    });

    // 3) mapear documentos
    const docs = rows.map(r => {
      const usuario = String(r['Usuario'] || '').trim().toUpperCase() || 'ADMIN';
      return {
        ownerKey: usuario,
        data: r,
        modifiedAt: new Date(),
        modifiedBy: 'admin-import'
      };
    });

    // 4) persistir
    await Row.deleteMany({});
    await Row.insertMany(docs);

    // 5) gravar metadados (headers dinâmicos)
    await SheetMeta.findByIdAndUpdate(
      'current',
      {
        _id: 'current',
        headers,
        nonEditable: BASE_NON_EDITABLE,
        lastImportedAt: new Date(),
        lastImportedBy: (req.user?.name || req.user?.email || 'admin-import')
      },
      { upsert: true }
    );

    res.json({ ok: true, imported: docs.length, headers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

// ---------- META (headers + não editáveis) ----------
router.get('/api/meta', requireAuth, async (req, res) => {
  const meta = await SheetMeta.findById('current').lean();
  res.json({ ok:true, meta: meta || { headers: [], nonEditable: BASE_NON_EDITABLE } });
});

// ---------- LISTAR ----------
router.get('/api/rows', requireAuth, async (req, res) => {
  const { role } = req.user;
  const query = role === 'admin' ? {} : { ownerKey: role.toUpperCase() };
  const list = await Row.find(query).lean();
  res.json({ ok: true, rows: list });
});

// ---------- ATUALIZAR (por ID) ----------
router.put('/api/rows/:id', requireAuth, async (req, res) => {
  const { role, email, name } = req.user;
  const id = req.params.id;

  try {
    const meta = await SheetMeta.findById('current').lean();
    const nonEditable = (meta?.nonEditable || BASE_NON_EDITABLE).map(String);

    // Mantém apenas colunas editáveis
    const patch = {};
    for (const k of Object.keys(req.body || {})) {
      if (!nonEditable.includes(k)) patch[k] = req.body[k];
    }

    const row = await Row.findById(id);
    if (!row) return res.status(404).json({ ok:false, error:'NOT_FOUND' });

    if (role !== 'admin' && row.ownerKey !== role.toUpperCase()) {
      return res.status(403).json({ ok:false, error:'FORBIDDEN' });
    }

    row.data = { ...row.data, ...patch };
    row.modifiedAt = new Date();
    row.modifiedBy = name || email;
    await row.save();

    res.json({ ok:true, row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

// ---------- EXPORTAR (ADMIN) ----------
router.get('/api/export.xlsx', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const meta = await SheetMeta.findById('current').lean();
    const headers = meta?.headers || [];
    const rows = await Row.find({}).lean();

    // monta JSON ordenado pelos headers atuais
    const json = rows.map(r => {
      const ordered = {};
      for (const h of headers) ordered[h] = r.data?.[h] ?? null;
      // auditoria
      ordered._ownerKey   = r.ownerKey;
      ordered._modifiedAt = r.modifiedAt;
      ordered._modifiedBy = r.modifiedBy;
      return ordered;
    });

    const ws = XLSX.utils.json_to_sheet(json, { header: [...headers, '_ownerKey','_modifiedAt','_modifiedBy'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

// ---------- LIMPAR DADOS (ADMIN) -> APAGA TODAS AS LINHAS ----------
router.post('/api/clean', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const r = await Row.deleteMany({}); // remove toda a coleção de linhas
    // Mantemos SheetMeta (headers). Se quiser também apagar os headers, me avise.
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
