const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

const srcIcon = path.join(__dirname, 'src', 'assets', 'icon', 'favicon.png');
const destIcon = path.join(assetsDir, 'icon.png');

fs.copyFileSync(srcIcon, destIcon);
console.log(`Copied ${srcIcon} to ${destIcon}`);

try {
  console.log('Running capacitor-assets...');
  execSync('npx @capacitor/assets generate --android', { stdio: 'inherit' });
  console.log('Successfully generated Android launcher icons!');
} catch (error) {
  console.error('Error generating assets:', error);
}
