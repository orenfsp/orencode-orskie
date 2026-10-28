const fs = require('fs');
const path = require('path');

const dir = __dirname;

fs.readdirSync(dir)
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .forEach((f) => {
    require(path.join(dir, f));
    console.log(`воркер подключён: ${f}`);
  });