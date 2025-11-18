-- Script para crear/corregir las tablas de PostgreSQL

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Índices para no_requirements
CREATE INDEX IF NOT EXISTS idx_no_requirements_user_id ON no_requirements(user_id);
CREATE INDEX IF NOT EXISTS idx_no_requirements_area ON no_requirements(area);
CREATE INDEX IF NOT EXISTS idx_no_requirements_status ON no_requirements(status);
CREATE INDEX IF NOT EXISTS idx_no_requirements_dates ON no_requirements(start_date, end_date);

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
    UNIQUE(area, fiscal_year),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Índices para budgets
CREATE INDEX IF NOT EXISTS idx_budgets_area ON budgets(area);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON budgets(fiscal_year);

-- Verificar y corregir tabla suppliers si no tiene contact_person
DO $$
BEGIN
    -- Verificar si la columna contact_person existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'contact_person'
    ) THEN
        -- Si no existe, agregarla
        ALTER TABLE suppliers ADD COLUMN contact_person VARCHAR(255);
    END IF;

    -- Verificar si existe contact_name y renombrarla
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'contact_name'
    ) THEN
        -- Renombrar contact_name a contact_person
        ALTER TABLE suppliers RENAME COLUMN contact_name TO contact_person;
    END IF;
END $$;

-- Crear tabla audit_log si no existe
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

COMMIT;