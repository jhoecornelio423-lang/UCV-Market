/**
 * Genera los archivos src/environments/environment.ts y environment.prod.ts
 * a partir de variables de entorno (Netlify/CI) o de un archivo .env local.
 *
 * Uso:
 *   node generate-env.js
 *
 * Variables requeridas:
 *   SUPABASE_URL  -> URL del proyecto Supabase
 *   SUPABASE_KEY  -> anon key pública de Supabase
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const envFile = loadEnvFile();
const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || envFile.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[generate-env] ERROR: Faltan SUPABASE_URL y/o SUPABASE_KEY.\n' +
    'Configúralos como variables de entorno (Netlify/CI) o crea el archivo .env en frontend/ ' +
    'basándote en .env.example.'
  );
  process.exit(1);
}

const writeEnvFile = (target, production) => {
  const content = `export const environment = {
  production: ${production},
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}'
};
`;
  fs.writeFileSync(path.join(__dirname, target), content, 'utf8');
  console.log(`[generate-env] ${target} generado correctamente.`);
};

writeEnvFile('./src/environments/environment.ts', false);
writeEnvFile('./src/environments/environment.prod.ts', true);
