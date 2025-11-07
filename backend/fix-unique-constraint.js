const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('🔧 Recreando tabla no_requirements sin restricciones problemáticas...');

db.serialize(() => {
  // Eliminar tabla actual
  db.run(`DROP TABLE IF EXISTS no_requirements`, (err) => {
    if (err) {
      console.error('❌ Error eliminando tabla:', err.message);
      return;
    }
    console.log('✅ Tabla anterior eliminada');
    
    // Crear nueva tabla sin restricción UNIQUE problemática
    db.run(`
      CREATE TABLE no_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        area TEXT NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        justification TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pendiente',
        approved_by INTEGER,
        approved_at DATETIME,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creando nueva tabla:', err.message);
      } else {
        console.log('✅ Nueva tabla no_requirements creada exitosamente');
        console.log('📋 Sin restricción UNIQUE - puedes crear múltiples registros');
        
        // Verificar que se creó correctamente
        db.all("PRAGMA table_info(no_requirements)", (err, columns) => {
          if (err) {
            console.error('❌ Error verificando estructura:', err.message);
          } else {
            console.log('\n📄 Estructura de la nueva tabla:');
            columns.forEach(col => {
              console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? '(PK)' : ''}`);
            });
          }
          
          console.log('\n🎉 ¡Listo! Reinicia el servidor y prueba crear un No Requerimiento');
          db.close();
        });
      }
    });
  });
});