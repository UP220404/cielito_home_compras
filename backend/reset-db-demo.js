const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('🧹 Limpiando base de datos para demo...\n');

// Lista de 10 proveedores profesionales para Aguascalientes
const suppliers = [
  {
    name: 'Ferretería y Materiales El Constructor',
    rfc: 'FMC850312ABC',
    contact_name: 'Ing. Roberto Martínez',
    phone: '449-915-2345',
    email: 'ventas@elconstructor.com.mx',
    address: 'Av. Aguascalientes Norte 1234, Fracc. Bosques del Prado, Aguascalientes, Ags.',
    category: 'Ferretería y Construcción',
    payment_terms: 'Crédito 30 días',
    delivery_days: 3,
    rating: 4.8,
    notes: 'Proveedor de materiales de construcción y herramientas. Entregas rápidas en zona metropolitana.'
  },
  {
    name: 'Office Depot Aguascalientes',
    rfc: 'ODA920815XYZ',
    contact_name: 'Lic. María Fernanda González',
    phone: '449-918-3456',
    email: 'corporativo.ags@officedepot.com.mx',
    address: 'Blvd. José María Chávez 1501, Col. Lindavista, Aguascalientes, Ags.',
    category: 'Papelería y Oficina',
    payment_terms: 'Contado / Crédito 15 días',
    delivery_days: 2,
    rating: 4.7,
    notes: 'Amplio catálogo de artículos de oficina, papelería y tecnología. Facturación electrónica inmediata.'
  },
  {
    name: 'Suministros Médicos del Centro SA de CV',
    rfc: 'SMC880420DEF',
    contact_name: 'Dr. Carlos López Ramírez',
    phone: '449-916-4567',
    email: 'ventas@suministrosmedicos.com.mx',
    address: 'Av. Convención de 1914 Nte. 567, Centro, Aguascalientes, Ags.',
    category: 'Equipo Médico y Salud',
    payment_terms: 'Crédito 30 días',
    delivery_days: 5,
    rating: 4.9,
    notes: 'Especialistas en equipo médico, insumos hospitalarios y botiquines empresariales. Certificaciones vigentes.'
  },
  {
    name: 'Computadoras y Tecnología TechZone',
    rfc: 'CTT910605GHI',
    contact_name: 'Ing. Ana Patricia Rodríguez',
    phone: '449-920-5678',
    email: 'ventas@techzone.com.mx',
    address: 'Av. Universidad 2401, Fracc. Trojes de Alonso, Aguascalientes, Ags.',
    category: 'Tecnología y Cómputo',
    payment_terms: 'Contado / Crédito 15 días',
    delivery_days: 2,
    rating: 4.6,
    notes: 'Distribuidor autorizado de marcas como HP, Dell, Lenovo. Servicio técnico incluido y garantías extendidas.'
  },
  {
    name: 'Limpieza Industrial del Bajío',
    rfc: 'LIB930225JKL',
    contact_name: 'Lic. Pedro Sánchez Mora',
    phone: '449-914-6789',
    email: 'contacto@limpiezabajio.com.mx',
    address: 'Calle Libertad 456, Fracc. Jardines de la Asunción, Aguascalientes, Ags.',
    category: 'Limpieza y Sanitización',
    payment_terms: 'Crédito 30 días',
    delivery_days: 3,
    rating: 4.5,
    notes: 'Productos de limpieza industriales, químicos especializados y equipo de protección. Asesoría técnica.'
  },
  {
    name: 'Mobiliario Corporativo Office Plus',
    rfc: 'MCO870518MNO',
    contact_name: 'Arq. Laura Gutiérrez Villalobos',
    phone: '449-922-7890',
    email: 'proyectos@officeplus.com.mx',
    address: 'Blvd. Luis Donaldo Colosio 3210, Fracc. Pulgas Pandas Sur, Aguascalientes, Ags.',
    category: 'Mobiliario y Equipamiento',
    payment_terms: 'Contado / Crédito 30 días',
    delivery_days: 7,
    rating: 4.7,
    notes: 'Mobiliario ergonómico de oficina, salas de juntas y recepción. Instalación y diseño de espacios incluido.'
  },
  {
    name: 'Publicidad y Diseño Creativa MX',
    rfc: 'PDC950810PQR',
    contact_name: 'Lic. Iván Arellano Torres',
    phone: '449-917-8901',
    email: 'info@creativamx.com.mx',
    address: 'Av. Independencia 789, Centro, Aguascalientes, Ags.',
    category: 'Publicidad y Marketing',
    payment_terms: '50% anticipo, 50% contra entrega',
    delivery_days: 10,
    rating: 4.8,
    notes: 'Material promocional, diseño gráfico, impresión digital y offset. Especialistas en branding corporativo.'
  },
  {
    name: 'Aire Acondicionado y Refrigeración Clima Total',
    rfc: 'AAR890915STU',
    contact_name: 'Ing. José Manuel Hernández',
    phone: '449-919-9012',
    email: 'servicio@climatotal.com.mx',
    address: 'Av. Tecnológico 1523, Col. La Fuente, Aguascalientes, Ags.',
    category: 'Climatización y HVAC',
    payment_terms: 'Crédito 15 días',
    delivery_days: 5,
    rating: 4.6,
    notes: 'Instalación, mantenimiento y venta de equipos de clima. Servicio de emergencia 24/7. Técnicos certificados.'
  },
  {
    name: 'Insumos Eléctricos e Iluminación LED Pro',
    rfc: 'IEI920330VWX',
    contact_name: 'Lic. Guadalupe Ramírez Castro',
    phone: '449-921-0123',
    email: 'ventas@ledproags.com.mx',
    address: 'Calle Galeana Sur 234, Centro, Aguascalientes, Ags.',
    category: 'Eléctrico e Iluminación',
    payment_terms: 'Contado / Crédito 30 días',
    delivery_days: 2,
    rating: 4.7,
    notes: 'Iluminación LED comercial e industrial, cableado eléctrico y material para instalaciones. Ahorro energético garantizado.'
  },
  {
    name: 'Alimentos y Bebidas Corporativas Nutri-Office',
    rfc: 'ABC960520YZA',
    contact_name: 'Lic. Mariana Cadena López',
    phone: '449-923-1234',
    email: 'ventas@nutrioffice.com.mx',
    address: 'Av. Héroe de Nacozari 890, Fracc. Morelos I, Aguascalientes, Ags.',
    category: 'Alimentos y Bebidas',
    payment_terms: 'Crédito 15 días',
    delivery_days: 1,
    rating: 4.9,
    notes: 'Servicio de lunch, coffee breaks, despensas y snacks saludables. Planes mensuales y eventos especiales.'
  }
];

db.serialize(() => {
  // 1. Limpiar tablas (manteniendo usuarios)
  console.log('📋 Eliminando datos antiguos...');

  db.run('DELETE FROM notifications', (err) => {
    if (err) console.error('Error limpiando notifications:', err.message);
    else console.log('   ✅ Notificaciones eliminadas');
  });

  db.run('DELETE FROM quotation_items', (err) => {
    if (err) console.error('Error limpiando quotation_items:', err.message);
    else console.log('   ✅ Items de cotización eliminados');
  });

  db.run('DELETE FROM quotations', (err) => {
    if (err) console.error('Error limpiando quotations:', err.message);
    else console.log('   ✅ Cotizaciones eliminadas');
  });

  db.run('DELETE FROM purchase_orders', (err) => {
    if (err) console.error('Error limpiando purchase_orders:', err.message);
    else console.log('   ✅ Órdenes de compra eliminadas');
  });

  db.run('DELETE FROM request_items', (err) => {
    if (err) console.error('Error limpiando request_items:', err.message);
    else console.log('   ✅ Items de solicitud eliminados');
  });

  db.run('DELETE FROM requests', (err) => {
    if (err) console.error('Error limpiando requests:', err.message);
    else console.log('   ✅ Solicitudes eliminadas');
  });

  db.run('DELETE FROM suppliers', (err) => {
    if (err) console.error('Error limpiando suppliers:', err.message);
    else console.log('   ✅ Proveedores eliminados');
  });

  db.run('DELETE FROM email_log', (err) => {
    if (err) console.error('Error limpiando email_log:', err.message);
    else console.log('   ✅ Log de emails eliminado');
  });

  db.run('DELETE FROM audit_log', (err) => {
    if (err) console.error('Error limpiando audit_log:', err.message);
    else console.log('   ✅ Log de auditoría eliminado');
  });

  // Esperar a que se completen las eliminaciones
  setTimeout(() => {
    console.log('\n🏢 Creando 10 proveedores profesionales...\n');

    // 2. Insertar nuevos proveedores
    suppliers.forEach((supplier, index) => {
      db.run(`
        INSERT INTO suppliers (
          name, rfc, contact_name, phone, email, address,
          category, payment_terms, delivery_days, rating, active, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [
        supplier.name,
        supplier.rfc,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.category,
        supplier.payment_terms,
        supplier.delivery_days,
        supplier.rating,
        supplier.notes
      ], function(err) {
        if (err) {
          console.error(`   ❌ Error creando ${supplier.name}:`, err.message);
        } else {
          console.log(`   ✅ ${index + 1}. ${supplier.name}`);
          console.log(`      Categoría: ${supplier.category}`);
          console.log(`      Contacto: ${supplier.contact_name} - ${supplier.phone}`);
          console.log(`      Rating: ${supplier.rating}/5.0`);
          console.log('');
        }

        // Si es el último proveedor, mostrar resumen
        if (index === suppliers.length - 1) {
          setTimeout(() => {
            console.log('═══════════════════════════════════════════════════════');
            console.log('🎉 BASE DE DATOS LISTA PARA DEMO');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
            console.log('✅ Usuarios mantenidos: 12');
            console.log('✅ Proveedores creados: 10');
            console.log('✅ Solicitudes: 0 (listo para crear nuevas)');
            console.log('✅ Cotizaciones: 0 (listo para agregar)');
            console.log('✅ Órdenes: 0 (listo para generar)');
            console.log('');
            console.log('📋 CATEGORÍAS DE PROVEEDORES:');
            console.log('   • Ferretería y Construcción');
            console.log('   • Papelería y Oficina');
            console.log('   • Equipo Médico y Salud');
            console.log('   • Tecnología y Cómputo');
            console.log('   • Limpieza y Sanitización');
            console.log('   • Mobiliario y Equipamiento');
            console.log('   • Publicidad y Marketing');
            console.log('   • Climatización y HVAC');
            console.log('   • Eléctrico e Iluminación');
            console.log('   • Alimentos y Bebidas');
            console.log('');
            console.log('🚀 El sistema está listo para tu demostración!');
            console.log('');
            db.close();
          }, 500);
        }
      });
    });
  }, 1000);
});
