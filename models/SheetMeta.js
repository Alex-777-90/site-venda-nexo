// models/SheetMeta.js
const mongoose = require('../db/mongo');

const SheetMetaSchema = new mongoose.Schema({
  // guardamos sempre 1 doc (chave fixa "current")
  _id: { type: String, default: 'current' },
  headers: { type: [String], default: [] },          // ordem dos headers do Excel
  nonEditable: { type: [String], default: [] },      // colunas travadas
  lastImportedAt: { type: Date, default: Date.now },
  lastImportedBy: { type: String, default: 'admin-import' }
});

module.exports = mongoose.model('SheetMeta', SheetMetaSchema);
