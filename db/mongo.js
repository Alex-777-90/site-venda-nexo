// db/mongo.js
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('Faltou MONGO_URI no .env');
  process.exit(1);
}

mongoose.set('strictQuery', false);
mongoose.connect(uri, { dbName: 'nexo_app' })
  .then(() => console.log('[Mongo] conectado'))
  .catch(err => {
    console.error('[Mongo] erro:', err);
    process.exit(1);
  });

module.exports = mongoose;
