const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_URL || './database.sqlite';

console.log('🌱 Ejecutando seed de datos de Cielito Home...');

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a SQLite database para seed');
});

// Función para ejecutar queries con promesas
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

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

// Proveedores de ejemplo para Aguascalientes
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
    const existing = await getQuery('SELECT id FROM users WHERE email = ?', [user.email]);
    
    if (!existing) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      await runQuery(`
        INSERT INTO users (name, email, password, area, role)
        VALUES (?, ?, ?, ?, ?)
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
    const existing = await getQuery('SELECT id FROM suppliers WHERE name = ?', [supplier.name]);
    
    if (!existing) {
      await runQuery(`
        INSERT INTO suppliers (name, rfc, contact_name, phone, email, address, category, rating)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        supplier.name, 
        supplier.rfc, 
        supplier.contact_name, 
        supplier.phone, 
        supplier.email, 
        supplier.address, 
        supplier.category,
        4.5 + Math.random() * 0.5 // Rating entre 4.5 y 5.0
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
      user_email: 'sistemas@cielitohome.com', // Paulina - Sistemas
      area: 'Sistemas',
      request_date: '2025-01-15',
      delivery_date: '2025-01-25',
      urgency: 'alta',
      priority: 'urgente',
      justification: 'Renovación de equipos de cómputo para el área de sistemas debido a obsolescencia tecnológica',
      status: 'autorizada'
    },
    {
      folio: 'REQ-2025-002',
      user_email: 'marketing@cielitohome.com', // Ivan - Marketing
      area: 'Marketing',
      request_date: '2025-01-20',
      delivery_date: '2025-02-01',
      urgency: 'media',
      priority: 'normal',
      justification: 'Material promocional para campaña publicitaria de febrero 2025',
      status: 'cotizando'
    },
    {
      folio: 'REQ-2025-003',
      user_email: 'sistemas5cielitohome@gmail.com', // Estefania - Mantenimiento
      area: 'Mantenimiento',
      request_date: '2025-01-22',
      delivery_date: '2025-01-30',
      urgency: 'alta',
      priority: 'critica',
      justification: 'Reparación urgente del sistema de aire acondicionado principal del edificio',
      status: 'pendiente'
    },
    {
      folio: 'REQ-2025-004',
      user_email: 'atencionmedicacielitoh@gmail.com', // Miriam - Servicio Médico
      area: 'Servicio Médico',
      request_date: '2025-01-23',
      delivery_date: '2025-02-05',
      urgency: 'media',
      priority: 'urgente',
      justification: 'Renovación de inventario médico mensual y equipo de primeros auxilios',
      status: 'pendiente'
    }
  ];

  const sampleItems = [
    // Items para REQ-2025-001 (Sistemas)
    [
      {
        material: 'Laptop Dell Inspiron 15 3000',
        specifications: 'Intel i5-1235U, 8GB RAM DDR4, 256GB SSD, Windows 11 Pro, pantalla 15.6" FHD',
        approximate_cost: 15000,
        quantity: 3,
        unit: 'pza'
      },
      {
        material: 'Monitor LG 24MK430H',
        specifications: 'Monitor 24" Full HD IPS, HDMI, VGA, compatible con VESA',
        approximate_cost: 4500,
        quantity: 3,
        unit: 'pza'
      },
      {
        material: 'Mouse y Teclado inalámbrico Logitech MK540',
        specifications: 'Combo wireless, receptor USB unificado, batería de larga duración',
        approximate_cost: 800,
        quantity: 3,
        unit: 'set'
      }
    ],
    // Items para REQ-2025-002 (Marketing)
    [
      {
        material: 'Folletos promocionales',
        specifications: 'Papel couché 150gr, impresión full color, tamaño carta, acabado brillante',
        approximate_cost: 2500,
        quantity: 1000,
        unit: 'pza'
      },
      {
        material: 'Plumas promocionales personalizadas',
        specifications: 'Plumas BIC con logo Cielito Home, tinta azul, clip metálico',
        approximate_cost: 800,
        quantity: 500,
        unit: 'pza'
      },
      {
        material: 'Banners publicitarios',
        specifications: 'Lona 3x1.5m, impresión digital, ojillos reforzados, diseño corporativo',
        approximate_cost: 1200,
        quantity: 5,
        unit: 'pza'
      }
    ],
    // Items para REQ-2025-003 (Mantenimiento)
    [
      {
        material: 'Filtro de aire acondicionado HEPA',
        specifications: 'Filtro HEPA H13, compatible con sistema York 5 toneladas, marco de aluminio',
        approximate_cost: 1200,
        quantity: 2,
        unit: 'pza'
      },
      {
        material: 'Refrigerante R410A',
        specifications: 'Cilindro de 11.3kg, refrigerante ecológico certificado, válvula de seguridad',
        approximate_cost: 3500,
        quantity: 1,
        unit: 'cilindro'
      },
      {
        material: 'Kit de herramientas para HVAC',
        specifications: 'Manómetros digitales, llaves Allen, cortador de tubo, detector de fugas',
        approximate_cost: 2800,
        quantity: 1,
        unit: 'kit'
      }
    ],
    // Items para REQ-2025-004 (Servicio Médico)
    [
      {
        material: 'Botiquín de primeros auxilios empresarial',
        specifications: 'Botiquín tipo A, incluye vendas, gasas, antisépticos, termómetro digital',
        approximate_cost: 850,
        quantity: 3,
        unit: 'pza'
      },
      {
        material: 'Oxímetro de pulso digital',
        specifications: 'Pantalla OLED, medición SpO2 y frecuencia cardíaca, certificado FDA',
        approximate_cost: 1200,
        quantity: 2,
        unit: 'pza'
      },
      {
        material: 'Tensiómetro digital automatico',
        specifications: 'Brazalete adulto estándar, memoria para 2 usuarios, validado clínicamente',
        approximate_cost: 1800,
        quantity: 1,
        unit: 'pza'
      }
    ]
  ];

  for (let i = 0; i < sampleRequests.length; i++) {
    const request = sampleRequests[i];
    
    // Obtener ID del usuario
    const user = await getQuery('SELECT id FROM users WHERE email = ?', [request.user_email]);
    if (!user) {
      console.log(`   ❌ Usuario no encontrado: ${request.user_email}`);
      continue;
    }

    // Verificar si la solicitud ya existe
    const existing = await getQuery('SELECT id FROM requests WHERE folio = ?', [request.folio]);
    if (existing) {
      console.log(`   ⚠️  Solicitud ${request.folio} ya existe`);
      continue;
    }

    // Obtener ID del director para autorización
    const director = await getQuery('SELECT id FROM users WHERE role = "director"', []);

    const requestResult = await runQuery(`
      INSERT INTO requests (folio, user_id, area, request_date, delivery_date, urgency, priority, justification, status, authorized_by, authorized_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      request.folio,
      user.id,
      request.area,
      request.request_date,
      request.delivery_date,
      request.urgency,
      request.priority,
      request.justification,
      request.status,
      request.status === 'autorizada' ? director.id : null,
      request.status === 'autorizada' ? new Date().toISOString() : null
    ]);

    console.log(`   ✅ ${request.folio} - ${request.area}`);

    // Insertar items de la solicitud
    const items = sampleItems[i];
    for (const item of items) {
      await runQuery(`
        INSERT INTO request_items (request_id, material, specifications, approximate_cost, quantity, unit) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [requestResult.id, item.material, item.specifications, item.approximate_cost, item.quantity, item.unit]);
      
      console.log(`      → ${item.material}`);
    }
  }
}

// Función principal
async function seedDatabase() {
  try {
    console.log('🏢 CIELITO HOME - Sistema de Compras');
    console.log('⚠️  Agregando datos reales de la empresa');
    console.log('   Contraseña para todos los usuarios: cielito2025');
    console.log('');
    
    await seedUsers();
    await seedSuppliers();
    await createSampleRequests();
    
    console.log('');
    console.log('🎉 Datos de Cielito Home insertados correctamente');
    console.log('');
    console.log('📋 CREDENCIALES DE ACCESO:');
    console.log('');
    console.log('👑 DIRECCIÓN GENERAL:');
    console.log('   direcciongeneral@cielitohome.com - Yessica Tovar');
    console.log('');
    console.log('🛒 ÁREA DE COMPRAS:');
    console.log('   compras@cielitohome.com - Brenda Espino');
    console.log('');
    console.log('🔧 ADMINISTRADOR DEL SISTEMA:');
    console.log('   sistemas16ch@gmail.com - Lenin Silva');
    console.log('');
    console.log('👥 JEFES DE ÁREA (SOLICITANTES):');
    console.log('   sistemas@cielitohome.com - Paulina González (Sistemas)');
    console.log('   marketing@cielitohome.com - Ivan Arellano (Marketing)');
    console.log('   juridico@cielitohome.com - Mariana Cadena (Jurídico)');
    console.log('   atencionaclientes@cielitohome.com - Nayeli Pulido (Atención a clientes)');
    console.log('   logistica1cielitohome@gmail.com - Jacel Saldaña (Logística)');
    console.log('   diroperacionescielitohome@gmail.com - Yadira Luna (Operaciones)');
    console.log('   sistemas5cielitohome@gmail.com - Estefania Gutierrez (Mantenimiento)');
    console.log('   atencionmedicacielitoh@gmail.com - Miriam Muñóz (Servicio Médico)');
    console.log('');
    console.log('🚀 SIGUIENTE PASO: npm start');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando base de datos:', err.message);
      }
      process.exit(0);
    });
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  console.log('🏢 ¿Seguro que quieres agregar los datos de Cielito Home? (Ctrl+C para cancelar)');
  setTimeout(seedDatabase, 2000);
}

module.exports = { seedDatabase };
