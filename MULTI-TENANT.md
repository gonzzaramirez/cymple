# Gymple — Arquitectura Multi-Tenant por Subdominios

Este documento es la **referencia canónica** del modelo multi-tenant de Gymple: cómo cada gimnasio se identifica por subdominio, cómo se aíslan sus datos, qué viaja en cada request, qué se valida en cada capa de seguridad y cómo desplegarlo en una VPS para que `gym1.gymple.com`, `gym2.gymple.com`, etc. funcionen "out of the box".

> Está alineado con el código real (Express 5 + Prisma 6 + Next.js 15 + Baileys). Si algún día el comportamiento cambia, este archivo es la fuente de verdad a actualizar.

---

## 1. Resumen ejecutivo

- **Un solo backend, un solo frontend, una sola base de datos PostgreSQL**.
- Cada gimnasio = **un tenant** = una fila en la tabla `gym` con un `slug` único.
- El **subdominio** del request determina el tenant (`<slug>.gymple.com` → `slug`).
- Todo registro de negocio lleva una columna `gym_id` y todas las queries Prisma filtran/insertan con ese `gym_id`.
- El **JWT** del usuario incluye su `gymId`. El backend verifica que el `gymId` del token sea el mismo que el del subdominio: si no coinciden, devuelve `403`.
- En producción **CORS** sólo permite `BASE_DOMAIN` y sus subdominios. En desarrollo se usa el header `X-Gym-Slug` para simular tenants distintos sin tener DNS.

```mermaid
flowchart LR
  user[Usuario en gym1.gymple.com] --> dns[DNS Wildcard *.gymple.com]
  dns --> nginx[Nginx / Reverse Proxy]
  nginx --> next[Next.js Frontend]
  nginx --> express[Express Backend]
  express --> tm[tenantMiddleware]
  tm --> als[AsyncLocalStorage<br/>req.gymId = N]
  als --> svc[Service Layer<br/>getGymId]
  svc --> prisma[Prisma Client<br/>where gym_id = N]
  prisma --> db[(PostgreSQL única)]
```

---

## 2. Modelo conceptual

- **Tenant root**: tabla `gym`. Define `slug`, `name`, `timezone`, `is_active`, `logo_url`, `whatsapp_number`, etc. Ver [Back/prisma/schema.prisma](Back/prisma/schema.prisma) líneas 15‑52.
- **`gym_id` en todas las entidades**: `person`, `app_user`, `client`, `membership`, `client_membership`, `payment`, `attendance`, `routine`, `whatsapp_*`, etc. Cada relación apunta a `gym(gym_id)` con FK.
- **Índices únicos compuestos**: cualquier "único" de negocio incluye `gym_id`. Por ejemplo:

```96:99:Back/prisma/schema.prisma
  @@unique([gym_id, dni], map: "uq_person_gym_dni")
  @@unique([gym_id, phone], map: "uq_person_gym_phone")
  @@unique([gym_id, email], map: "uq_person_gym_email")
  @@index([gym_id], map: "idx_person_gym_id")
```

Esto significa que dos gyms distintos pueden tener un cliente con el mismo DNI/email/teléfono sin conflicto: la unicidad sólo aplica dentro del mismo tenant.

- **Tabla `tenant_config`**: feature flags por gimnasio (prorrateo calendario, restricción de trainers, días de gracia de cobro, etc.). Una fila por gym.

---

## 3. Resolución de tenant por subdominio

### 3.1 Flujo en producción (`NODE_ENV=production`)

El backend confía en el header `Host` (que Nginx debe pasar tal cual) para extraer el slug:

```9:35:Back/src/middleware/tenantMiddleware.ts
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let slug: string | undefined;

    if (NODE_ENV === 'production') {
      const hostname = req.hostname;

      if (!hostname.endsWith(`.${BASE_DOMAIN}`) && hostname !== BASE_DOMAIN) {
        res.status(400).json({ error: 'Invalid host' });
        return;
      }

      const parts = hostname.replace(`.${BASE_DOMAIN}`, '').split('.');
      slug = parts[0];

      const headerSlug = req.headers['x-gym-slug'] as string | undefined;
      if (headerSlug && headerSlug !== slug) {
        res.status(400).json({ error: 'Tenant mismatch' });
        return;
      }
    } else {
      slug = (req.headers['x-gym-slug'] as string) || 'demo';
    }
```

Reglas clave:

- Si el host **no termina** en `.${BASE_DOMAIN}` y tampoco es exactamente `BASE_DOMAIN`, responde `400 Invalid host`.
- Saca el `slug` del primer label del subdominio.
- Si el frontend mandó `X-Gym-Slug` y **no coincide** con el del subdominio, responde `400 Tenant mismatch`. Esto evita que un cliente abra `gym1.gymple.com` y le pegue al backend declarando ser `gym2`.

### 3.2 Flujo en desarrollo (`NODE_ENV !== production`)

- El subdominio no se consulta. El slug viene del header **`X-Gym-Slug`**.
- Si el header no llega, se asume `demo`.
- Esto permite levantar local con `localhost:3000` y `localhost:3080` sin necesidad de DNS, hosts files ni certificados.

### 3.3 Validación del gym y propagación

```42:56:Back/src/middleware/tenantMiddleware.ts
    const gym = await prisma.gym.findUnique({
      where: { slug },
    });

    if (!gym || !gym.is_active || gym.deleted_at) {
      res.status(404).json({ error: 'Gym not found' });
      return;
    }

    req.gymId = gym.gym_id;
    req.gym = gym;

    tenantStorage.run({ gymId: gym.gym_id }, () => {
      next();
    });
```

- Se carga el `gym` por `slug`. Si está inactivo o "soft-deleted", se devuelve `404 Gym not found`.
- Se enriquecen `req.gymId` y `req.gym` para los controllers.
- Se abre un **AsyncLocalStorage** (`tenantStorage`) con el `gymId` para que los services puedan obtenerlo sin recibir `req` como parámetro.

### 3.4 Endpoint público de resolución

El frontend resuelve branding (logo, color, timezone, feature flags) con un endpoint público: `GET /gyms/by-slug/:slug`. Es la única ruta de `/gyms/*` que no exige `super_admin`.

```7:8:Back/src/modules/gyms/gyms.routes.ts
// Public: get gym info by slug (used by frontend to resolve tenant)
router.get('/by-slug/:slug', gymController.getGymPublicInfo);
```

---

## 4. Propagación del contexto de tenant en el backend

Existen **tres formas** de acceder al tenant dentro de una request:

1. **`req.gymId` / `req.gym`** — útiles en middlewares y controllers que ya reciben `req`.
2. **`AsyncLocalStorage` (`tenantStorage`)** — declarado en [Back/src/config/tenant-context.ts](Back/src/config/tenant-context.ts). Usado por el helper `getGymId()`:

```1:15:Back/src/config/tenant-context.ts
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentGymId(): number {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('No tenant context available. Ensure tenantMiddleware is applied.');
  }
  return ctx.gymId;
}
```

```6:8:Back/src/config/prisma-tenant.ts
export function getGymId(): number {
  return getCurrentGymId();
}
```

3. **`req.tenantConfig`** — feature flags por gym, agregados por `tenantConfigMiddleware` en las rutas que lo aplican (clients, memberships, dashboard):

```13:38:Back/src/middleware/tenantConfigMiddleware.ts
export const tenantConfigMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const gymId = req.gymId;
    if (gymId == null) {
      res.status(400).json({ error: 'Tenant (gym) not resolved. Ensure tenantMiddleware runs first.' });
      return;
    }

    const row = await prisma.tenant_config.findUnique({
      where: { gym_id: gymId },
    });

    req.tenantConfig = {
      restrictTrainersToOwnClients: row?.restrict_trainers_to_own_clients ?? DEFAULT_TENANT_CONFIG.restrictTrainersToOwnClients,
      billingGraceEndDay: row?.billing_grace_end_day ?? DEFAULT_TENANT_CONFIG.billingGraceEndDay,
      allowAttendanceDuringGrace:
        row?.allow_attendance_during_grace ?? DEFAULT_TENANT_CONFIG.allowAttendanceDuringGrace,
      calendarMidMonthProrationEnabled:
        row?.calendar_mid_month_proration_enabled ??
        DEFAULT_TENANT_CONFIG.calendarMidMonthProrationEnabled,
    };
    next();
```

---

## 5. Aislamiento de datos en Prisma

Toda lectura y escritura **debe** filtrar por `gym_id`. El patrón obligatorio en services es `getGymId()` resolviendo desde el ALS.

### 5.1 Lectura típica (clients)

```146:151:Back/src/modules/clients/clients.service.ts
const gymId = getGymId();
const where = buildClientWhere(tenantConfig, currentUser, { gym_id: gymId, deleted_at: null });

const clients = await prisma.client.findMany({
  where,
```

### 5.2 Escritura típica (attendance)

```60:63:Back/src/modules/attendance/attendance.service.ts
await prisma.attendance.create({
  data: {
    gym_id: getGymId(),
```

### 5.3 SQL crudo también es tenant-scoped

Cuando se usa `$queryRaw` (dashboard, reports), el `gym_id` se pasa por parámetro:

```92:96:Back/src/modules/dashboard/dashboard.service.ts
WHERE cm.gym_id = ${gymId}
  AND cm.deleted_at IS NULL
  AND cm.status <> 'CANCELLED'
  ${trainerSql}
```

### 5.4 Garantías

- Si un service olvida el filtro, igual no puede "saltar" entre tenants en operaciones únicas porque los `@@unique([gym_id, ...])` los aislan a nivel DB.
- `getGymId()` **lanza error** si se llama fuera de un request con `tenantMiddleware`. Esto evita que un cron o script ejecute queries sin tenant accidentalmente (los crons deben fijar el contexto explícitamente con `tenantStorage.run(...)`).

---

## 6. Seguridad por capas

Gymple aplica **defense in depth**: si una capa falla, la siguiente sigue protegiendo los datos.

### 6.1 CORS dinámico por dominio base

```55:91:Back/src/server.ts
if (NODE_ENV === 'production') {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        try {
          const url = new URL(origin);
          if (url.hostname === BASE_DOMAIN || url.hostname.endsWith(`.${BASE_DOMAIN}`)) {
            return callback(null, true);
          }
        } catch {
          // invalid origin
        }
        callback(new Error('CORS not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Gym-Slug'],
    }),
  );
```

En producción, sólo orígenes `https://*.gymple.com` o `https://gymple.com` pueden hacer CORS. Cualquier otro dominio es rechazado.

### 6.2 Tenant validado contra el host

`tenantMiddleware` valida que el host **pertenezca** a `BASE_DOMAIN` antes de extraer el slug. Esto descarta requests con `Host` arbitrarios.

### 6.3 JWT con `gymId` y validación cruzada

El token incluye `gymId`:

```33:40:Back/src/models/auth.ts
export interface JwtPayload {
  userId: number;
  ...
  gymId: number;
}
```

El `authMiddleware` exige que el `gymId` del token coincida con el resuelto por el host (excepto para `super_admin`):

```24:27:Back/src/middleware/authMiddleware.ts
if (req.gymId && decoded.gymId !== req.gymId && decoded.roleName !== 'super_admin') {
  res.status(403).json({ error: 'Token does not belong to this gym' });
  return;
}
```

Es decir, un usuario de `gym1` **no puede** robar el JWT y usarlo desde `gym2.gymple.com`: el backend lo rechaza con `403`.

### 6.4 Roles

Hay tres roles efectivos (`super_admin`, `admin`/`Administrador`, `personal`, `usuario`). El rol vive en el JWT y se exige con guards:

- `requireSuperAdmin` — gestiona la tabla `gym` (alta/baja/edición de tenants).
- `requireGymAdmin` — admin del gym local.
- `requireRole(...)` — granularidad por endpoint.

El `super_admin` es la **única** identidad que puede operar entre tenants y se usa típicamente en una consola interna.

### 6.5 Cookies y tokens

- El JWT se guarda en `localStorage.accessToken` y en `document.cookie` (`accessToken=...; SameSite=Lax`).
- La cookie se setea **sin** `Domain=`, por lo que es **host-only**: `gym1.gymple.com` y `gym2.gymple.com` no la comparten. Esto es deseable: si un usuario logueado en un gym abre el dominio de otro, no se filtra el token.

### 6.6 Hardening recomendado en VPS

- `JWT_SECRET` debe ser una cadena aleatoria larga (≥ 64 bytes hex).
- `BASE_DOMAIN` exacto, sin `https://` ni puerto.
- Activar HSTS y `X-Frame-Options` en Nginx (ver bloque ejemplo más abajo).
- Restringir el endpoint `GET /gyms/by-slug/:slug` a información pública (logo, color, timezone, flag de prorrateo). El controller actual ya hace esto: ver [Back/src/modules/gyms/gyms.controller.ts](Back/src/modules/gyms/gyms.controller.ts).
- Considerar setear cookies con `Secure; HttpOnly; SameSite=Strict` cuando se sirva siempre por HTTPS.

---

## 7. Qué viaja en cada request

Cuando el frontend habla con el backend, la información de tenant se transporta por **tres canales redundantes** (todos verificables en backend):

- **Header `Host`**: lo agrega el navegador/Nginx automáticamente. Es la fuente principal del slug en producción.
- **Header `X-Gym-Slug`**: lo agrega el frontend desde [Front/lib/api/auth.ts](Front/lib/api/auth.ts):

```231:235:Front/lib/api/auth.ts
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "X-Gym-Slug": getGymSlug(),
  ...options.headers,
};
```

  En producción se valida que coincida con el subdominio (`Tenant mismatch` si no). En desarrollo es la única fuente del slug.

- **Header `Authorization: Bearer <jwt>`**: el JWT contiene `gymId`, `userId`, `roleName`. El backend verifica que el `gymId` del token coincida con el del host.

El **cuerpo** de la respuesta jamás incluye datos de otros gyms porque todas las consultas filtran por `gym_id` automáticamente.

---

## 8. Frontend: cómo detecta y propaga el tenant

### 8.1 Resolución del slug (cliente)

```30:49:Front/contexts/GymContext.tsx
function resolveSlug(): string {
  if (typeof window === "undefined") return "demo";

  const hostname = window.location.hostname;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.")
  ) {
    return localStorage.getItem("gymSlug") || "demo";
  }

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "gymple.com";
  if (hostname.endsWith(`.${baseDomain}`)) {
    return hostname.replace(`.${baseDomain}`, "").split(".")[0];
  }

  return "demo";
}
```

- En `localhost` lee `localStorage.gymSlug` (o `demo`). Para probar otro tenant en local: `localStorage.setItem("gymSlug", "powerfit")`.
- En producción saca el slug del subdominio comparando con `NEXT_PUBLIC_BASE_DOMAIN`.

### 8.2 Carga de info pública del gym

`GymProvider` llama a `GET /gyms/by-slug/:slug` para obtener `name`, `logoUrl`, `primaryColor`, `timezone`, etc., y los expone en `useGym()` para toda la UI.

### 8.3 Llamadas autenticadas

Cualquier llamada a la API debe ir por `authenticatedFetch()`, que inyecta `Authorization` y `X-Gym-Slug` automáticamente. Si un módulo usa `fetch` plano, debe hacerlo a propósito (ej. login público).

### 8.4 Middleware de Next ([Front/proxy.ts](Front/proxy.ts))

Sólo gatea por presencia de cookie `accessToken` y redirige `/dashboard/*` a `/login` si no hay sesión. No resuelve tenant: eso lo hace el cliente y el backend.

---

## 9. Onboarding de un nuevo gimnasio (operativo, sin redeploy)

Para dar de alta un nuevo cliente SaaS **no hace falta tocar DNS, ni Nginx, ni código**:

1. Insertar fila en `gym`:

   ```sql
   INSERT INTO gym (name, slug, timezone, is_active)
   VALUES ('PowerFit', 'powerfit', 'America/Argentina/Buenos_Aires', true);
   ```

2. (Opcional) Insertar `tenant_config` si querés overrides de los defaults. Si no, se aplican los defaults de `DEFAULT_TENANT_CONFIG`.
3. Crear un usuario `admin` ligado a ese `gym_id` (vía API con `super_admin` o seed):

   ```sql
   -- pseudocódigo: crear person + app_user con role admin
   ```

4. Entregar al cliente la URL: `https://powerfit.gymple.com`.

El registro DNS comodín `*.gymple.com` ya existe a nivel de zona y el certificado SSL es wildcard, así que el subdominio nuevo funciona inmediatamente.

> Si un cliente quiere **dominio propio** (`app.powerfit.com`), hay que:
>
> - Crear un `CNAME` en su zona apuntando a `powerfit.gymple.com`.
> - Agregar ese host como `server_name` adicional en Nginx (o aceptarlo a nivel del proxy).
> - Ajustar `tenantMiddleware` o un alias en DB para mapear ese host al slug `powerfit`. Esto **hoy no está implementado**, requiere una pequeña extensión.

---

## 10. Despliegue en VPS

### 10.1 Requisitos previos

- VPS con Linux (Ubuntu 22.04+ o Amazon Linux 2023 — ver [docs/deployment/EC2_DEPLOYMENT.md](docs/deployment/EC2_DEPLOYMENT.md) como referencia paso a paso).
- Node.js 20+ y npm.
- PostgreSQL 15+.
- Nginx (o Traefik).
- Dominio registrado y gestionable por DNS (idealmente Cloudflare, Route53 o cualquier proveedor con API para DNS-01).
- Puerto 80 y 443 abiertos.

### 10.2 DNS

En la zona de `gymple.com` crear:

- `A   gymple.com   → IP_VPS`
- `A   *.gymple.com → IP_VPS` (registro **wildcard**, esencial)

Con esto, **todos** los subdominios futuros (`gym1.gymple.com`, `gym2.gymple.com`, ...) resuelven a la misma VPS sin tocar DNS de nuevo.

### 10.3 Certificado SSL **wildcard**

Un certificado HTTP-01 normal **no sirve** para subdominios arbitrarios. Hay que usar Let's Encrypt **DNS-01** con un proveedor que tenga API.

Ejemplo con `certbot` y Cloudflare:

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d gymple.com -d '*.gymple.com'
```

Esto genera un cert que cubre tanto `gymple.com` como cualquier `<slug>.gymple.com`. Programar `certbot renew` por cron/systemd-timer.

### 10.4 Nginx (reverse proxy con wildcard)

Hay un ejemplo base en [docs/deployment/nginx.conf](docs/deployment/nginx.conf), pero para multi-tenant en producción debe quedar así (puntos importantes resaltados):

```nginx
server {
    listen 443 ssl http2;
    server_name gymple.com *.gymple.com;

    ssl_certificate     /etc/letsencrypt/live/gymple.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gymple.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Backend API
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;          # CLAVE: pasa <slug>.gymple.com tal cual
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}

server {
    listen 80;
    server_name gymple.com *.gymple.com;
    return 301 https://$host$request_uri;
}
```

Detalles que **no se pueden omitir**:

- `server_name gymple.com *.gymple.com;` para que Nginx acepte cualquier subdominio.
- `proxy_set_header Host $host;` para que Express vea el subdominio real en `req.hostname` (sin esto, `tenantMiddleware` no puede extraer el slug).
- Si Express está detrás de proxy y querés que `req.hostname` ignore proxies inyectados, considerar `app.set('trust proxy', 1)` en el backend (no está activo hoy y no es estrictamente necesario para que funcione el slug, pero sí para `req.ip`).

### 10.5 Variables de entorno

**Backend** ([Back/.env.example](Back/.env.example) y [docs/deployment/back.env.production](docs/deployment/back.env.production)):

```env
DATABASE_URL="postgresql://USER:PASS@localhost:5432/gymple?schema=public"
PORT=3080
NODE_ENV=production
TZ=America/Argentina/Buenos_Aires
JWT_SECRET=<64+ bytes hex>
BASE_DOMAIN=gymple.com
# CORS_ORIGINS no es necesario en producción: se deriva automáticamente de BASE_DOMAIN.
```

**Frontend** ([docs/deployment/front.env.production](docs/deployment/front.env.production)):

```env
NEXT_PUBLIC_API_URL=https://gymple.com/api
NEXT_PUBLIC_BASE_DOMAIN=gymple.com
```

> El frontend puede usar `NEXT_PUBLIC_API_URL=/api` si lo servís siempre detrás del mismo Nginx (el navegador resuelve la URL relativa al host actual, lo que naturalmente usa el subdominio del usuario).

### 10.6 Build y arranque

Backend:

```bash
cd Back
npm ci
npx prisma migrate deploy
npm run build           # genera dist/ con tsc
node dist/server.js     # o gestionarlo con pm2 / systemd
```

Frontend:

```bash
cd Front
npm ci
npm run build
npm start               # next start, escucha en 3000 por defecto
```

Recomendado con PM2:

```bash
pm2 start dist/server.js --name gymple-back
pm2 start "npm start" --name gymple-front --cwd /opt/gymple/Front
pm2 save && pm2 startup
```

### 10.7 Persistencia de sesiones de WhatsApp (Baileys)

Baileys guarda credenciales en disco. Si despliega en contenedor, montar un volumen persistente sobre la carpeta de auth (revisar `Back/src/modules/whatsapp/`). Sin volumen, cada redeploy obliga a re-escanear el QR de cada gym.

### 10.8 Verificación post-deploy

1. `curl https://gymple.com/health` → `{"status":"Server is running",...}`.
2. Crear gym `demo` y un admin asociado.
3. Abrir `https://demo.gymple.com`, loguearse, navegar el dashboard.
4. Crear un segundo gym `test2` y un admin propio. Loguearse en `https://test2.gymple.com` y confirmar que **no** ve datos de `demo` (clientes, pagos, asistencias deben estar vacíos).
5. Intentar usar el JWT de `demo` contra `https://test2.gymple.com/api/clients`: debe responder `403 Token does not belong to this gym`.

Si los 5 puntos pasan, el aislamiento está intacto.

---

## 11. Errores comunes y diagnóstico

- `400 Invalid host` — el `Host` recibido no termina en `BASE_DOMAIN`. Verificar `proxy_set_header Host $host;` en Nginx y que `BASE_DOMAIN` esté bien configurado en el `.env` del backend.
- `400 Tenant mismatch` — el `X-Gym-Slug` no coincide con el subdominio. Suele pasar si el frontend está hardcodeado a otro slug; revisar `localStorage.gymSlug` o `NEXT_PUBLIC_BASE_DOMAIN`.
- `400 Could not resolve tenant` — en dev, falta el header `X-Gym-Slug` (raro, hay fallback a `demo`).
- `404 Gym not found` — el slug no existe, está `is_active = false` o tiene `deleted_at`.
- `403 Token does not belong to this gym` — el JWT pertenece a otro gym distinto al del subdominio actual. Re-loguearse o verificar que el token no esté siendo reusado entre subdominios.
- `401 No token provided` / `Invalid or expired token` — falta `Authorization` o el JWT está vencido. El frontend tiene refresh automático en `authenticatedFetch`.

---

## 12. Convivencia con documentación previa

Existe una versión histórica en [docs/deployment/multi-tenant-architecture-and-deploy.md](docs/deployment/multi-tenant-architecture-and-deploy.md) escrita pensando en Dokploy + Traefik + WhatsApp Web. **Este archivo (`MULTI-TENANT.md`) es la referencia vigente**: refleja el código actual (Express + Baileys + Nginx) y reemplaza al anterior cuando haya divergencia.

---

## 13. Resumen para "salir a producción"

- DNS: `A` raíz + `A *` apuntando a la VPS.
- Cert SSL **wildcard** vía DNS-01.
- Nginx con `server_name gymple.com *.gymple.com` y `proxy_set_header Host $host;`.
- Backend con `BASE_DOMAIN`, `NODE_ENV=production`, `JWT_SECRET` fuerte, `DATABASE_URL` apuntando a PG.
- Frontend con `NEXT_PUBLIC_BASE_DOMAIN` y `NEXT_PUBLIC_API_URL`.
- Migrar Prisma (`prisma migrate deploy`) y crear el primer gym + admin.
- Verificar aislamiento entre dos gyms reales.

A partir de ahí, dar de alta nuevos clientes es **una fila en la tabla `gym` y un usuario admin**. Nada más.
