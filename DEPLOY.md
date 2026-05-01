# Guía de Deploy a Producción

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Backend (NestJS)](#3-backend-nestjs)
4. [Frontend (Next.js)](#4-frontend-nextjs)
5. [Base de datos](#5-base-de-datos)
6. [Crear un profesional independiente](#6-crear-un-profesional-independiente)
7. [Crear un centro médico](#7-crear-un-centro-médico)
8. [Agregar profesionales a un centro existente](#8-agregar-profesionales-a-un-centro-existente)

---

## 1. Requisitos previos

- Node.js 20+
- PostgreSQL 15+
- (Opcional) PM2 para process management en producción

---

## 2. Variables de entorno

### Backend — `back/.env`

```env
# Base de datos
DATABASE_URL="postgresql://usuario:password@host:5432/medagenda"

# JWT
JWT_SECRET="un_secreto_largo_y_aleatorio_minimo_32_chars"
JWT_EXPIRES_IN="12h"

# Puerto (opcional, default 3001)
PORT=3001

# URL pública del frontend (para CORS)
FRONTEND_URL="https://tudominio.com"

# WhatsApp / Evolution API (si aplica)
EVOLUTION_API_URL="https://evolution.tudominio.com"
EVOLUTION_API_KEY="tu_api_key"
```

### Frontend — `front/.env.local`

```env
# URL del backend (server-side)
NEXT_PUBLIC_API_URL="https://api.tudominio.com"
API_BASE_URL="https://api.tudominio.com"

# Nombre de la cookie de auth (no cambiar)
AUTH_COOKIE_NAME="medagenda_token"
```

---

## 3. Backend (NestJS)

```bash
cd back

# 1. Instalar dependencias
npm install

# 2. Generar cliente Prisma
npx prisma generate

# 3. Aplicar migraciones a la base de datos
npx prisma migrate deploy

# 4. Build de producción
npm run build

# 5. Iniciar en producción
npm run start:prod

# — Con PM2 (recomendado) —
pm2 start dist/main.js --name medagenda-api
pm2 save
pm2 startup
```

---

## 4. Frontend (Next.js)

```bash
cd front

# 1. Instalar dependencias
npm install

# 2. Build de producción
npm run build

# 3. Iniciar
npm start

# — Con PM2 —
pm2 start npm --name medagenda-front -- start
pm2 save
```

---

## 5. Base de datos

### Primera vez (base vacía)

```bash
cd back

# Crea todas las tablas
npx prisma migrate deploy

# Genera el cliente
npx prisma generate
```

### Actualizaciones de schema (nuevas migraciones)

```bash
cd back
npx prisma migrate deploy
npx prisma generate
```

> **Importante:** nunca ejecutar `prisma migrate dev` en producción. Solo `migrate deploy`.

---

## 6. Crear un profesional independiente

### Opción A — Seed de demo (solo para testing)

Crea una cuenta de demo con credenciales predefinidas:

```bash
cd back
npm run prisma:seed:professional
```

Credenciales generadas:
| Campo    | Valor           |
|----------|-----------------|
| Email    | test@gmail.com  |
| Password | test123         |
| Acceso   | `/login` → `/home` |

### Opción B — Creación manual en base de datos

Ejecutar el siguiente script (reemplazar los valores):

```bash
cd back
npx ts-node -e "
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash('CONTRASEÑA_AQUI', 12);
  const p = await prisma.professional.create({
    data: {
      slug: 'slug-unico',           // identificador de URL (solo minúsculas, guiones)
      fullName: 'Nombre Completo',
      email: 'email@dominio.com',
      passwordHash: hash,
      phone: '+5491100000000',
      standardFee: new Prisma.Decimal(10000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    }
  });
  console.log('Profesional creado:', p.id);
  await prisma.\$disconnect();
}
run();
"
```

El profesional accede en `/login` y es redirigido a `/home`.

---

## 7. Crear un centro médico

### Opción A — Seed de demo (solo para testing)

Crea un centro con dos profesionales miembros:

```bash
cd back
npm run prisma:seed:center
```

Credenciales generadas:

| Rol           | Email                  | Password   | Acceso               |
|---------------|------------------------|------------|----------------------|
| Centro admin  | centro@demo.com        | centro123  | `/login` → `/center/home` |
| Profesional A | dra.garcia@demo.com    | profA123   | `/login` → `/home`   |
| Profesional B | dr.lopez@demo.com      | profB123   | `/login` → `/home`   |

### Opción B — Creación manual (producción)

**Paso 1:** Crear la organización (centro) directamente en la base de datos:

```bash
cd back
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash('CONTRASEÑA_CENTRO', 12);
  const org = await prisma.organization.create({
    data: {
      slug: 'mi-clinica',              // identificador del centro (único, solo minúsculas y guiones)
      name: 'Mi Clínica',             // nombre visible
      email: 'admin@mi-clinica.com',  // email de acceso del centro admin
      passwordHash: hash,
      phone: '+5491100000000',
      timezone: 'America/Argentina/Buenos_Aires',
    }
  });
  console.log('Centro creado:', org.id, org.slug);
  await prisma.\$disconnect();
}
run();
"
```

**Paso 2:** Ingresar como centro admin y crear profesionales desde el panel:

1. Ir a `/login`
2. Ingresar con el email y password del centro
3. Redirige automáticamente a `/center/home`
4. Ir a `/center/professionals` → **"Nuevo profesional"**
5. Completar el formulario y guardar

Los profesionales creados desde el panel reciben automáticamente:
- Un `slug` generado a partir del nombre del centro y el nombre del profesional
- Su `organizationId` asociado al centro
- Acceso a `/home` donde solo ven sus turnos y pacientes

---

## 8. Agregar profesionales a un centro existente

### Desde el frontend (recomendado)

1. Ingresar como **centro admin** en `/login`
2. Ir a **Profesionales** (`/center/professionals`)
3. Clic en **"Nuevo profesional"**
4. Completar:
   - Nombre completo
   - Email (será su usuario de acceso)
   - Contraseña
   - Teléfono (opcional)
   - Especialidad (opcional)
   - Duración de turno (minutos, default 30)
   - Buffer entre turnos (minutos, default 10)
   - Honorario estándar
5. Guardar → el profesional ya puede ingresar en `/login`

### Desde la base de datos (alternativa)

```bash
cd back
npx ts-node -e "
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function run() {
  // Obtener el id de la organización
  const org = await prisma.organization.findUnique({ where: { slug: 'mi-clinica' } });
  if (!org) throw new Error('Centro no encontrado');

  const hash = await bcrypt.hash('CONTRASEÑA_PROFESIONAL', 12);
  const p = await prisma.professional.create({
    data: {
      slug: \`\${org.slug}-dr-nuevo\`,
      fullName: 'Dr. Nuevo',
      email: 'dr.nuevo@mi-clinica.com',
      passwordHash: hash,
      organizationId: org.id,
      standardFee: new Prisma.Decimal(8000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    }
  });
  console.log('Profesional creado:', p.id);
  await prisma.\$disconnect();
}
run();
"
```

---

## Resumen de flujo por tipo de usuario

```
Login (/login)
  ├─ email de ORGANIZACIÓN  →  role: CENTER_ADMIN  →  /center/home
  │    └─ puede gestionar profesionales, turnos, pacientes de todo el centro
  │
  ├─ email de PROFESIONAL con organizationId  →  role: CENTER_MEMBER  →  /home
  │    └─ ve solo sus turnos y sus pacientes
  │
  └─ email de PROFESIONAL sin organizationId  →  role: INDEPENDENT  →  /home
       └─ gestión completa de su agenda personal
```

---

## Notas de seguridad

- Cambiar todas las contraseñas de demo antes de exponer el sistema públicamente.
- El `JWT_SECRET` debe tener al menos 32 caracteres aleatorios.
- Usar HTTPS en producción.
- No compartir el archivo `.env` en repositorios.
