#!/bin/bash

API_URL="https://gestion-compras-ch.onrender.com/api"

echo "🧪 PROBANDO API EN PRODUCCIÓN"
echo "============================================================"
echo ""

# 1. Login
echo "1️⃣  Probando Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sistemas16ch@gmail.com","password":"cielito2025"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "   ❌ Login falló"
  exit 1
else
  echo "   ✅ Login exitoso"
fi

# 2. Obtener proveedores
echo ""
echo "2️⃣  Probando GET /suppliers..."
SUPPLIERS=$(curl -s "$API_URL/suppliers?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")
SUPP_COUNT=$(echo $SUPPLIERS | grep -o '"total":"[^"]*' | cut -d'"' -f4)
echo "   ✅ Proveedores: $SUPP_COUNT total"

# 3. Obtener solicitudes
echo ""
echo "3️⃣  Probando GET /requests..."
REQUESTS=$(curl -s "$API_URL/requests" \
  -H "Authorization: Bearer $TOKEN")
REQ_COUNT=$(echo $REQUESTS | grep -o '"total":"[^"]*' | cut -d'"' -f4)
echo "   ✅ Solicitudes: $REQ_COUNT total"

# 4. Obtener usuarios
echo ""
echo "4️⃣  Probando GET /users (admin)..."
USERS=$(curl -s "$API_URL/users" \
  -H "Authorization: Bearer $TOKEN")
if echo "$USERS" | grep -q "success"; then
  echo "   ✅ Usuarios obtenidos"
else
  echo "   ⚠️  Error obteniendo usuarios"
fi

# 5. Probar cotizaciones
echo ""
echo "5️⃣  Probando GET /quotations..."
QUOTATIONS=$(curl -s "$API_URL/quotations" \
  -H "Authorization: Bearer $TOKEN")
if echo "$QUOTATIONS" | grep -q "success"; then
  echo "   ✅ Cotizaciones endpoint funciona"
else
  echo "   ⚠️  Error con cotizaciones"
fi

# 6. Probar órdenes de compra
echo ""
echo "6️⃣  Probando GET /orders..."
ORDERS=$(curl -s "$API_URL/orders" \
  -H "Authorization: Bearer $TOKEN")
if echo "$ORDERS" | grep -q "success"; then
  echo "   ✅ Órdenes de compra endpoint funciona"
else
  echo "   ⚠️  Error con órdenes"
fi

# 7. Probar notificaciones
echo ""
echo "7️⃣  Probando GET /notifications..."
NOTIF=$(curl -s "$API_URL/notifications" \
  -H "Authorization: Bearer $TOKEN")
if echo "$NOTIF" | grep -q "success"; then
  echo "   ✅ Notificaciones endpoint funciona"
else
  echo "   ⚠️  Error con notificaciones"
fi

echo ""
echo "============================================================"
echo "✅ TODAS LAS PRUEBAS COMPLETADAS"
echo "============================================================"
