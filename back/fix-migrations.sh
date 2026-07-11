#!/bin/sh
# Fix migrations for test DB: limpia el estado de _prisma_migrations
# y marca todas las migraciones como aplicadas.
# Correr ADENTRO del contenedor (no en local).
# No borra datos — solo repara el rastro de migraciones.

set -e

cd /app/back 2>/dev/null || cd /app 2>/dev/null || { echo "❌ No encuentra /app"; exit 1; }

echo "📦 Regenerando Prisma client..."
npx prisma generate

echo ""
echo "🧹 Limpiando tabla _prisma_migrations..."
npx prisma db execute --stdin <<'SQL'
DELETE FROM "_prisma_migrations";
SQL

echo ""
echo "✅ Marcando TODAS las migraciones como aplicadas..."
for m in $(ls prisma/migrations/ | grep -v temp_antiban | sort); do
  echo "   → $m"
  npx prisma migrate resolve --applied "$m"
done

echo ""
echo "📦 Regenerando Prisma client post-fix..."
npx prisma generate

echo ""
echo "✅ Fix completado. Ahora reiniciá el backend:"
echo "   Si usás Dokploy → reiniciá el servicio desde el panel"
echo "   Si usás PM2     → pm2 restart all"
echo "   Si usás systemd → systemctl restart <servicio>"
