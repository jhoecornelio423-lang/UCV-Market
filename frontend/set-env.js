const fs = require('fs');

const targetPath = './src/environments/environment.prod.ts';

const supabaseUrl = process.env.SUPABASE_URL || 'https://dqjuifzsowwrrfppczsj.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxanVpZnpzb3d3cnJmcHBjenNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE3OTMsImV4cCI6MjEwMTQyNzc5M30.GqhJMgsqchqTE6-XG00efPO9GyKA0ov4BFx2zXsbrUQ';

const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}'
};
`;

fs.writeFileSync(targetPath, envConfigFile, 'utf8');
console.log(`Production environment file generated successfully.`);
