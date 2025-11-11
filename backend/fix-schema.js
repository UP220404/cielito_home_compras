const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixSchema() {
    console.log('🔧 Ejecutando corrección del esquema de PostgreSQL...\n');

    try {
        const client = await pool.connect();

        // Leer el archivo SQL
        const sqlScript = fs.readFileSync(path.join(__dirname, 'fix-schema.sql'), 'utf8');

        // Ejecutar el script
        console.log('📝 Ejecutando script SQL...');
        await client.query(sqlScript);

        console.log('✅ Esquema corregido exitosamente');

        // Verificar las tablas creadas
        console.log('\n📋 Verificando tablas:');
        
        const tables = ['no_requirements', 'budgets', 'suppliers', 'audit_log'];
        
        for (const table of tables) {
            const result = await client.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_name = $1
            `, [table]);
            
            if (result.rows[0].count > 0) {
                console.log(`✅ ${table}: existe`);
                
                // Mostrar columnas
                const columns = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    ORDER BY ordinal_position
                `, [table]);
                
                const columnNames = columns.rows.map(c => c.column_name).join(', ');
                console.log(`   Columnas: ${columnNames}`);
            } else {
                console.log(`❌ ${table}: no existe`);
            }
        }

        client.release();

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

fixSchema();