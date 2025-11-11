const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSchema() {
    console.log('🔍 Verificando esquema de PostgreSQL...\n');

    try {
        const client = await pool.connect();

        // Verificar tabla no_requirements
        console.log('📋 Tabla no_requirements:');
        const noReqColumns = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'no_requirements'
            ORDER BY ordinal_position
        `);
        
        if (noReqColumns.rows.length === 0) {
            console.log('❌ Tabla no_requirements no existe');
        } else {
            noReqColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
            });
        }

        // Verificar tabla budgets
        console.log('\n💰 Tabla budgets:');
        const budgetColumns = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'budgets'
            ORDER BY ordinal_position
        `);
        
        if (budgetColumns.rows.length === 0) {
            console.log('❌ Tabla budgets no existe');
        } else {
            budgetColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
            });
        }

        // Verificar tabla suppliers
        console.log('\n🏪 Tabla suppliers:');
        const suppliersColumns = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'suppliers'
            ORDER BY ordinal_position
        `);
        
        if (suppliersColumns.rows.length === 0) {
            console.log('❌ Tabla suppliers no existe');
        } else {
            suppliersColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
            });
        }

        // Verificar todas las tablas existentes
        console.log('\n📊 Todas las tablas en la base de datos:');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        tables.rows.forEach(table => {
            console.log(`  - ${table.table_name}`);
        });

        client.release();

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();