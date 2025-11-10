// models/Row.js
const mongoose = require('../db/mongo');

const RowSchema = new mongoose.Schema({
  ownerKey: { type: String, index: true },   // vem de "Usuario" da planilha (P7/NDR/NCOLLOR/admin)
  data: { type: Object, default: {} },       // linha inteira, chave = header do Excel
  modifiedAt: { type: Date, default: Date.now },
  modifiedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Row', RowSchema);
