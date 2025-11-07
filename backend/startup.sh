#!/bin/bash

# Script de inicio para Render
# Se ejecuta automáticamente en cada deploy

echo "🚀 Iniciando Sistema de Compras..."

# Si es la primera vez (DATABASE_URL existe pero tablas no), inicializar esquema
if [ -n "$DATABASE_URL" ]; then
  echo "📊 Verificando base de datos PostgreSQL..."

  # Intentar verificar si la tabla 'users' existe
  node -e "
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    pool.query('SELECT * FROM users LIMIT 1')
      .then(() => {
        console.log('✅ Base de datos ya inicializada');
        pool.end();
        process.exit(0);
      })
      .catch(() => {
        console.log('🔧 Inicializando esquema de base de datos...');
        pool.end();
        process.exit(1);
      });
  "

  # Si no existe la tabla, inicializar
  if [ $? -eq 1 ]; then
    echo "🔨 Ejecutando init-postgres.js..."
    node init-postgres.js

    if [ $? -eq 0 ]; then
      echo "✅ Base de datos inicializada correctamente"
    else
      echo "❌ Error inicializando base de datos"
      exit 1
    fi
  fi
else
  echo "📊 Usando SQLite (desarrollo local)"
fi

echo "🎯 Iniciando servidor..."
npm start
