const { execSync } = require('child_process');

beforeAll(() => {
  // Inicializa la base de datos antes de los tests
  execSync('node init-db.js', { stdio: 'inherit' });
});
