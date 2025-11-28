const path = require('path');
const backendDir = path.resolve(__dirname, 'backend');
const dbPath = path.join(backendDir, 'prisma', 'dev.db');
const absoluteDbPath = path.resolve(dbPath);

console.log('Current Dir:', __dirname);
console.log('Backend Dir:', backendDir);
console.log('DB Path:', dbPath);
console.log('Absolute DB Path:', absoluteDbPath);
