const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Ruta temporal para corregir esquema (SOLO PARA DESARROLLO)
router.get('/fix-schema', async (req, res) => {
  try {
    console.log('🔧 Iniciando corrección de esquema...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();

    // Script SQL directo (sin leer archivo)
    const sqlScript = `
-- Tabla no_requirements
CREATE TABLE IF NOT EXISTS no_requirements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    area VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
    approved_by INTEGER,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla budgets
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    area VARCHAR(100) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    annual_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
    spent_amount DECIMAL(15,2) DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(area, fiscal_year)
);

-- Corregir tabla suppliers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'contact_person'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN contact_person VARCHAR(255);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'contact_name'
    ) THEN
        ALTER TABLE suppliers RENAME COLUMN contact_name TO contact_person;
    END IF;
END $$;

-- Tabla audit_log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    `;

    console.log('📝 Ejecutando script SQL...');
    await client.query(sqlScript);

    // Verificar tablas
    const tables = ['no_requirements', 'budgets', 'suppliers', 'audit_log'];
    const results = {};
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      results[table] = {
        exists: result.rows[0].count > 0
      };
      
      if (results[table].exists) {
        const columns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);
        
        results[table].columns = columns.rows.map(c => c.column_name);
      }
    }

    client.release();
    await pool.end();

    res.json({
      success: true,
      message: 'Esquema corregido exitosamente',
      results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;