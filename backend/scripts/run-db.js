const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables from .env if present
try {
  require('dotenv').config();
} catch (_) {}

const mode = process.argv[2] || 'all'; // 'init', 'seed', or 'all'
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/ks_mfg_erp';

const isProduction = process.env.NODE_ENV === 'production';
const needsSsl =
  isProduction ||
  connectionString.includes('render.com') ||
  connectionString.includes('sslmode=require');

const client = new Client({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

const scriptsDir = path.resolve(__dirname, '../../dbscripts');

async function runScript(filename) {
  const filePath = path.join(scriptsDir, filename);
  console.log(`\n⏳ Running: ${filename}...`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`✅ Successfully executed: ${filename}`);
}

async function main() {
  console.log(`=========================================`);
  console.log(` KS-MFG ERP Database Script Runner`);
  console.log(` Target Mode: ${mode}`);
  console.log(` SSL Enabled: ${Boolean(needsSsl)}`);
  console.log(`=========================================`);

  await client.connect();
  console.log('Connected to PostgreSQL successfully.');

  try {
    if (mode === 'init' || mode === 'all') {
      await runScript('01_schema_objects.sql');
      await runScript('02_initial_data.sql');
    }
    if (mode === 'seed' || mode === 'all') {
      await runScript('03_sample_demo_data.sql');
    }
    console.log('\n🎉 Database setup completed successfully!');
  } catch (err) {
    console.error('\n❌ Error executing script:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
