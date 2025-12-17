const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// ===== USUARIOS REALES DE CIELITO HOME =====
const users = [
  // DIRECCIÓN GENERAL
  {
    email: 'direcciongeneral@cielitohome.com',
    name: 'Yessica Tovar',
    area: 'Dirección General',
    role: 'director'
  },

  // JEFES DE ÁREA (REQUESTERS)
  {
    email: 'sistemas@cielitohome.com',
    name: 'Paulina González',
    area: 'Sistemas',
    role: 'requester'
  },
  {
    email: 'marketing@cielitohome.com',
    name: 'Ivan Arellano',
    area: 'Marketing',
    role: 'requester'
  },
  {
    email: 'juridico@cielitohome.com',
    name: 'Mariana Cadena',
    area: 'Jurídico',
    role: 'requester'
  },
  {
    email: 'atencionaclientes@cielitohome.com',
    name: 'Nayeli Pulido',
    area: 'Atención a clientes',
    role: 'requester'
  },
  {
    email: 'logistica1cielitohome@gmail.com',
    name: 'Jacel Saldaña',
    area: 'Logística',
    role: 'requester'
  },
  {
    email: 'diroperacionescielitohome@gmail.com',
    name: 'Yadira Luna',
    area: 'Operaciones',
    role: 'requester'
  },
  {
    email: 'sistemas5cielitohome@gmail.com',
    name: 'Estefania Gutierrez',
    area: 'Mantenimiento',
    role: 'requester'
  },
  {
    email: 'atencionmedicacielitoh@gmail.com',
    name: 'Miriam Muñóz',
    area: 'Servicio Médico',
    role: 'requester'
  },

  // ÁREA DE COMPRAS
  {
    email: 'compras@cielitohome.com',
    name: 'Brenda Espino',
    area: 'Compras',
    role: 'purchaser'
  },

  // ADMINISTRADOR DEL SISTEMA
  {
    email: 'sistemas16ch@gmail.com',
    name: 'Lenin Silva',
    area: 'Sistemas',
    role: 'admin'
  }
];

// Proveedores de ejemplo
const suppliers = [
  {
    name: 'Ferretería El Martillo',
    category: 'Ferretería',
    phone: '449-123-4567',
    email: 'ventas@elmartillo.com',
    rfc: 'FEM950101XXX',
    contact_name: 'Juan Martínez',
    address: 'Av. Convención 123, Aguascalientes'
  },
  {
    name: 'Office Depot Aguascalientes',
    category: 'Papelería',
    phone: '449-234-5678',
    email: 'corporativo@officedepot.com',
    rfc: 'ODA890315YYY',
    contact_name: 'María González',
    address: 'Blvd. Luis Donaldo Colosio 456, Aguascalientes'
  },
  {
    name: 'Suministros Médicos SA',
    category: 'Médico',
    phone: '449-345-6789',
    email: 'contacto@sumedicos.com',
    rfc: 'SMS920607ZZZ',
    contact_name: 'Dr. Carlos López',
    address: 'Calle Madero 789, Centro, Aguascalientes'
  },
  {
    name: 'TechnoPC',
    category: 'Tecnología',
    phone: '449-456-7890',
    email: 'ventas@technopc.com',
    rfc: 'TPC880420AAA',
    contact_name: 'Ana Rodríguez',
    address: 'Av. Universidad 321, Aguascalientes'
  },
  {
    name: 'Limpieza Total',
    category: 'Limpieza',
    phone: '449-567-8901',
    email: 'info@limpiezatotal.com',
    rfc: 'LTT910512BBB',
    contact_name: 'Pedro Sánchez',
    address: 'Calle Libertad 654, Aguascalientes'
  }
];

async function seedUsers() {
  console.log('👥 Creando usuarios reales de Cielito Home...');
  const password = 'cielito2025';

  for (const user of users) {
    // Verificar si el usuario ya existe
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);

    if (existing.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync(password, 10);

      await pool.query(`
        INSERT INTO users (name, email, password, area, role)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.name, user.email, hashedPassword, user.area, user.role]);

      console.log(`   ✅ ${user.name} (${user.role}) - ${user.area}`);
    } else {
      console.log(`   ⚠️  ${user.name} ya existe`);
    }
  }
}

async function seedSuppliers() {
  console.log('🚚 Creando proveedores de ejemplo...');

  for (const supplier of suppliers) {
    // Verificar si el proveedor ya existe
    const existing = await pool.query('SELECT id FROM suppliers WHERE name = $1', [supplier.name]);

    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO suppliers (name, rfc, contact_name, phone, email, address, category, rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        supplier.name,
        supplier.rfc,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.category,
        4.5 + Math.random() * 0.5
      ]);

      console.log(`   ✅ ${supplier.name} - ${supplier.category}`);
    } else {
      console.log(`   ⚠️  ${supplier.name} ya existe`);
    }
  }
}

async function createSampleRequests() {
  console.log('📝 Creando solicitudes de ejemplo...');

  const sampleRequests = [
    {
      folio: 'REQ-2025-001',
      user_email: 'sistemas@cielitohome.com',
      area: 'Sistemas',
      request_date: '2025-01-15',
      delivery_date: '2025-01-25',
      urgency: 'alta',
      priority: 'urgente',
      justification: 'Renovación de equipos de cómputo para el área de sistemas',
      status: 'autorizada'
    },
    {
      folio: 'REQ-2025-002',
      user_email: 'marketing@cielitohome.com',
      area: 'Marketing',
      request_date: '2025-01-20',
      delivery_date: '2025-02-01',
      urgency: 'media',
      priority: 'normal',
      justification: 'Material promocional para campaña publicitaria',
      status: 'cotizando'
    }
  ];

  const sampleItems = [
    [
      {
        material: 'Laptop Dell Inspiron 15',
        specifications: 'Intel i5, 8GB RAM, 256GB SSD',
        approximate_cost: 15000,
        quantity: 3,
        unit: 'pza'
      },
      {
        material: 'Monitor LG 24"',
        specifications: 'Full HD IPS, HDMI',
        approximate_cost: 4500,
        quantity: 3,
        unit: 'pza'
      }
    ],
    [
      {
        material: 'Folletos promocionales',
        specifications: 'Papel couché 150gr, full color',
        approximate_cost: 2500,
        quantity: 1000,
        unit: 'pza'
      }
    ]
  ];

  for (let i = 0; i < sampleRequests.length; i++) {
    const request = sampleRequests[i];

    // Obtener ID del usuario
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [request.user_email]);
    if (userResult.rows.length === 0) {
      console.log(`   ❌ Usuario no encontrado: ${request.user_email}`);
      continue;
    }
    const userId = userResult.rows[0].id;

    // Verificar si la solicitud ya existe
    const existing = await pool.query('SELECT id FROM requests WHERE folio = $1', [request.folio]);
    if (existing.rows.length > 0) {
      console.log(`   ⚠️  Solicitud ${request.folio} ya existe`);
      continue;
    }

    // Obtener ID del director
    const directorResult = await pool.query('SELECT id FROM users WHERE role = $1', ['director']);
    const directorId = directorResult.rows.length > 0 ? directorResult.rows[0].id : null;

    const requestResult = await pool.query(`
      INSERT INTO requests (folio, user_id, area, request_date, delivery_date, urgency, priority, justification, status, authorized_by, authorized_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      request.folio,
      userId,
      request.area,
      request.request_date,
      request.delivery_date,
      request.urgency,
      request.priority,
      request.justification,
      request.status,
      request.status === 'autorizada' ? directorId : null,
      request.status === 'autorizada' ? new Date().toISOString() : null
    ]);

    console.log(`   ✅ ${request.folio} - ${request.area}`);

    // Insertar items
    const requestId = requestResult.rows[0].id;
    const items = sampleItems[i];
    for (const item of items) {
      await pool.query(`
        INSERT INTO request_items (request_id, material, specifications, approximate_cost, quantity, unit)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [requestId, item.material, item.specifications, item.approximate_cost, item.quantity, item.unit]);

      console.log(`      → ${item.material}`);
    }
  }
}

async function seedDatabase() {
  try {
    console.log('🏢 CIELITO HOME - Sistema de Compras');
    console.log('📊 Cargando datos en Neon Database');
    console.log('   Contraseña para todos los usuarios: cielito2025\n');

    await seedUsers();
    await seedSuppliers();
    await createSampleRequests();

    console.log('\n🎉 Datos de Cielito Home cargados correctamente en Neon!');
    console.log('\n📋 CREDENCIALES DE ACCESO:');
    console.log('');
    console.log('👑 DIRECCIÓN: direcciongeneral@cielitohome.com');
    console.log('🛒 COMPRAS: compras@cielitohome.com');
    console.log('🔧 ADMIN: sistemas16ch@gmail.com');
    console.log('\n🔑 Contraseña: cielito2025\n');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
