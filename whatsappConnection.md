# Conexión WhatsApp (Evolution API) — Guía para otro agente / proyecto

Este documento describe cómo **Gymple** integra WhatsApp usando **únicamente [Evolution API](https://doc.evolution-api.com/)** (HTTP + Baileys en el servidor Evolution). El código del monorepo puede incluir otros proveedores (`WAHA`, `WPPCONNECT`); aquí solo importa el camino **`EVOLUTION`**.

---

## 1. Visión general

| Capa | Rol |
|------|-----|
| **Evolution API** | Servicio externo que mantiene la sesión Baileys, expone REST (crear instancia, QR, estado, enviar texto, logout, etc.). |
| **Back (Express)** | Resuelve el **tenant** (`gym_id`), elige proveedor desde BD (debe ser `EVOLUTION`), llama a Evolution con `apikey`, normaliza teléfonos, aplica **anti-ban** y serializa envíos. |
| **PostgreSQL + Prisma** | Multi-tenant por `gym_id`: configuración de proveedor, historial de mensajes, cola de recordatorios, métricas anti-ban. La **sesión WhatsApp de Evolution** vive en el **servidor Evolution**, no en tablas de auth propias de Gymple para este flujo. |
| **Front (Next.js)** | Dashboard **Mensajes**: conectar / QR / desconectar vía API; lista de mensajes desde `/messages`; recordatorios condicionados a WhatsApp listo. |

---

## 2. Variables de entorno (Back)

Definidas en `Back/src/modules/whatsapp/providers/evolution.provider.ts`:

| Variable | Uso |
|----------|-----|
| `EVOLUTION_API_URL` | Base URL del servidor Evolution (ej. `https://wa.ejemplo.com`). Default en código: `https://wa.gymple.online`. |
| `EVOLUTION_API_KEY` | Cabecera `apikey` en todas las peticiones `fetch` a Evolution. Default en código: valor de ejemplo; en producción debe venir del entorno. |

El cliente HTTP añade siempre:

- `Content-Type: application/json`
- `apikey: <EVOLUTION_API_KEY>`

Timeout por request: **15 s**, con reintentos limitados en errores 5xx / abort.

---

## 3. Multi-tenant: cómo llega `gym_id` al módulo WhatsApp

1. **`tenantMiddleware`** (`Back/src/middleware/tenantMiddleware.ts`) corre antes de las rutas protegidas.
2. Resuelve el gimnasio:
   - **Producción**: subdominio `slug.BASE_DOMAIN` y validación opcional con cabecera `X-Gym-Slug`.
   - **Desarrollo**: cabecera `X-Gym-Slug` o slug por defecto `demo` (con fallback al primer gym activo si hace falta).
3. Guarda `req.gymId` y ejecuta el resto del pipeline dentro de `tenantStorage.run({ gymId }, …)` (`Back/src/config/tenant-context.ts`).

El servicio singleton **`WhatsAppService`** (`Back/src/modules/whatsapp/whatsapp.service.ts`) usa `tryGetCurrentGymId()` cuando los controladores no pasan `gymId` explícito: los endpoints de `/whatsapp` confían en ese contexto async.

**Implicación para otro proyecto:** toda llamada a start/status/logout/send debe ejecutarse en un request donde ya exista **tenant** (o pasar `gymId` explícitamente si se refactoriza).

---

## 4. Elección del proveedor: siempre Evolution en esta guía

`tenant_config.whatsapp_provider` (`enum`: `EVOLUTION` | `WAHA` | `WPPCONNECT`) en Prisma — default **`EVOLUTION`** (`Back/prisma/schema.prisma`).

- `WhatsAppService.fetchKindFromDb` lee `tenant_config` por `gym_id`.
- `mapDbProviderToKind`: cualquier valor que no sea `WAHA` o `WPPCONNECT` cae en **`EVOLUTION`**.
- `getProviderImpl('EVOLUTION')` devuelve la instancia de **`EvolutionProvider`**.

Para documentar solo Evolution: asegurar en BD `whatsapp_provider = EVOLUTION` (es el default al crear `tenant_config`).

---

## 5. Instancia Evolution por tenantEn `EvolutionProvider`:

```text
instanceName = "gymple-tenant-" + gymId
```

Ej.: gym `3` → `gymple-tenant-3`.

Cada gimnasio es **una instancia separada** en Evolution; no comparten QR ni sesión.

---

## 6. Endpoints Evolution usados por Gymple

Implementación: `Back/src/modules/whatsapp/providers/evolution.provider.ts`.

| Método | Ruta (relativa a `EVOLUTION_API_URL`) | Propósito |
|--------|----------------------------------------|-----------|
| GET | `/instance/connectionState/:instanceName` | Estado: `open`, `close`, `connecting`, etc. |
| POST | `/instance/create` | Crea instancia con `integration: WHATSAPP-BAILEYS`, `qrcode: true`, y flags (rechazar llamadas, ignorar grupos, etc.). Respuesta puede incluir `qrcode.base64`. |
| POST | `/instance/connect/:instanceName` | Reconexión / obtención de QR si la instancia ya existe o está en `close`. Respuesta puede traer `base64` del QR. |
| DELETE | `/instance/logout/:instanceName` | Cierra sesión en Evolution (“Desconectar” en UI). |
| POST | `/message/sendText/:instanceName` | Envío de texto; body incluye `number` (normalizado), `text`, `options.delay`, `options.presence: composing`. |
| POST | `/chat/whatsappNumbers/:instanceName` | Verificación de existencia en WA (`numbers: [...]`). |

Los paths exactos deben coincidir con la versión de Evolution desplegada (la familia Evolution suele mantener este estilo de rutas; verificar contra la doc de tu versión).

---

## 7. Flujos principales en el Back

### 7.1 `start` (conectar / generar QR)

1. Consulta `connectionState`. Si ya `open`, devuelve error tipo “ya conectado” y arranca health check.
2. Si no existe o falla, `POST /instance/create`.
3. Si create falla por instancia ya existente (`already exists` / `409`), intenta `POST /instance/connect`.
4. En éxito: devuelve `{ success, message, qr? }` y **`startHealthCheck(gymId)`**.

### 7.2 `getStatus` (para el front y recordatorios)

Mapeo a `SessionStatusInfo` (`Back/src/modules/whatsapp/whatsapp.contract.ts`):

| Estado Evolution / lógica | `status` | `isReady` | `qr` |
|----------------------------|----------|-----------|------|
| `open` | `ready` | `true` | `null` |
| `connecting` (+ connect con base64) | `qr` | `false` | base64 |
| `connecting` (sin QR aún) | `initializing` | `false` | `null` |
| Otros / intento `connect` con QR | `qr` o `disconnected` según caso | | |
| Fallos tras muchos reintentos de reconnect | `error` | `false` | mensaje usuario |

Si al consultar status la sesión pasa a `ready` con proveedor Evolution, `WhatsAppService` vuelve a asegurar **`startHealthCheck`**.

### 7.3 Health check y reconexión automática (solo EvolutionProvider)

- Intervalo: **5 minutos**.
- Si estado `close` o `unknown`: intenta **`autoReconnect`** con cooldown (30 s), hasta **5 intentos**; backoff incremental; usa `POST /instance/connect` cuando corresponde.
- Tras máximo de intentos: se detiene el intervalo; `getStatus` puede devolver `error` con mensaje de reconexión manual.

### 7.4 `logout`

- `DELETE /instance/logout/:instanceName`
- `WhatsAppService` llama **`stopHealthCheck`** antes, si el kind es `EVOLUTION`.

### 7.5 `sendHumanizedMessage`

1. **`WhatsAppService`** (capa común): mutex FIFO por `gym_id`, carga **anti-ban** desde `whatsapp_reminder_config`, cooldown entre envíos, persistencia de contadores / circuit breaker.
2. **`EvolutionProvider.sendHumanizedMessage`**: normaliza número (Argentina) vía `phone-normalizer`, reintentos de envío con posible `autoReconnect` si la sesión no está `open`.

Errores que disparan políticas anti-ban (p. ej. señales de ban) se interpretan en `antiban-guard.ts` — relevante si replicáis el mismo stack.

### 7.6 Primera conexión y “warm-up” anti-ban

Tras `start` exitoso, `WhatsAppService` ejecuta SQL que pone **`wa_connected_since`** en `whatsapp_reminder_config` si aún era `NULL`. Eso alimenta límites diarios progresivos (`getWarmUpDailyLimit`) al enviar.

---

## 8. API REST del Back (lo que consume el Front)

Montaje: `app.use('/whatsapp', whatsappRoutes)` con **`tenantMiddleware` + auth** previos (`Back/src/server.ts`).

| Método | Ruta | Handler | Notas |
|--------|------|---------|--------|
| POST | `/whatsapp/start` | `start` | Inicia instancia / QR. |
| GET | `/whatsapp/status` | `getStatus` | Estado + QR. |
| POST | `/whatsapp/logout` | `logout` | Desconexión Evolution. |
| POST | `/whatsapp/send` | `sendMessage` | Crea fila en `message`, envía por `sendHumanizedMessage`, marca `sent`. |
| POST | `/whatsapp/verify-phone` | `verifyPhoneController` | Usa `/chat/whatsappNumbers/...`. |
| GET/PUT | `/whatsapp/reminders/config` | reminders | Incluye `whatsappReady` según `getStatus`. |
| POST | `/whatsapp/reminders/prepare` / `send` | cron manual | Cola de recordatorios. |

**Prefijo en proxy:** el Front puede tener `NEXT_PUBLIC_API_URL` terminando en `/api`; `Front/lib/api/messages.ts` concatena `/whatsapp` o `/api/whatsapp` sin duplicar `/api`.

---

## 9. Prisma: tablas relevantes (multi-tenant)

Todas las filas llevan **`gym_id`** (directo o vía relación a `gym`).

| Modelo | Uso respecto a WhatsApp / Evolution |
|--------|-------------------------------------|
| `tenant_config` | `whatsapp_provider` — para esta guía: `EVOLUTION`. |
| `gym` | `whatsapp_number` opcional (dato de negocio, no sustituye la sesión Evolution). |
| `message` | Historial: `gym_id`, `client_membership_id`, `content`, `type`, `sent`, `created_at`. |
| `message_template` | Plantillas por gym y tipo. |
| `whatsapp_reminder_config` | Toggle recordatorios, crons, **anti-ban** (`daily_msg_count`, `circuit_breaker_until`, `wa_connected_since`). |
| `whatsapp_reminder_queue` | Cola D-3 / D0 para envío batch. |
| `whatsapp_auth_key` | Usado por integraciones que guardan credenciales Baileys en Postgres (p. ej. sesión propia). **El flujo Evolution de Gymple no depende de esta tabla** para mantener la sesión; Evolution persiste en su almacenamiento. |

---

## 10. Front: conexión, QR y desconexión

Archivos clave:

- `Front/lib/api/messages.ts` — `whatsappApi.startWhatsApp`, `getWhatsappStatus`, `logoutWhatsApp`, helpers de URL.
- `Front/app/dashboard/messages/components/WhatsAppConnection.tsx` — estado local, polling.
- `Front/app/dashboard/messages/components/WhatsAppStatus.tsx` — UI por estado (`disconnected`, `initializing`, `qr`, `ready`, `error`, `reconnecting`).

Comportamiento:

1. Al montar: `getWhatsappStatus()`.
2. Si está en `qr` / `initializing` / `reconnecting` / `error`: polling cada **5 s**.
3. **Conectar:** `POST start` → bucle hasta **20** intentos cada **800 ms** de `getWhatsappStatus` para no perder la carrera del QR (Evolution a veces devuelve el QR unos ms después del start).
4. **Desconectar:** diálogo de confirmación → `POST logout` → limpia estado y reconsulta status.
5. QR en pantalla: si el string no tiene prefijo `data:image`, se antepone `data:image/png;base64,`.

Autenticación: `authenticatedFetch` + en back la cabecera **`X-Gym-Slug`** (en dev) alinea el tenant con el usuario logueado.

---

## 11. Front: lista de mensajes y reenvío

- Página: `Front/app/dashboard/messages/page.tsx`.
- Lista: `GET /messages` → `fetchMessages()` (no es ruta de WhatsApp; es el módulo mensajes del gym actual).
- Reenvío unitario: `POST /messages/:id/resend`.
- Reenvío masivo fallidos del día: `POST /messages/resend-failed-today`.

Los registros reflejan el **historial en BD**; el canal de entrega efectivo cuando el proveedor es Evolution es **`sendText`** en Evolution.

---

## 12. Recordatorios automáticos

- Servicio: `Back/src/modules/whatsapp/whatsapp-reminders.service.ts`.
- Antes de habilitar o enviar: comprueba **`whatsappService.getStatus`** — si no está listo, no envía / no habilita según el caso.
- La cola `whatsapp_reminder_queue` se procesa con el mismo **`sendHumanizedMessage`** (y por tanto Evolution cuando `whatsapp_provider` es `EVOLUTION`).

---

## 13. Checklist para replicar en otro proyecto (solo Evolution)

1. Desplegar **Evolution API** estable y anotar URL + **API key global**.
2. Por tenant, definir **`instanceName`** estable (en Gymple: `gymple-tenant-{id}`).
3. Implementar middleware de **tenant** que inyecte `gymId` en contexto de request.
4. Cliente HTTP con `apikey`, timeouts y manejo de QR asíncrono.
5. Exponer **`/start`**, **`/status`**, **`/logout`**, **`/send`** alineados con vuestra capa de auth.
6. En UI: **polling agresivo** tras `start` hasta recibir QR o `ready`.
7. Opcional pero recomendado en Gymple: **health check** + reconnect acotado + **rate limiting / anti-ban** en la capa de aplicación.
8. Mantener **`tenant_config.whatsapp_provider = EVOLUTION`** (o equivalente) para no mezclar con otros drivers.

---

## 14. Archivos de referencia en este repo

| Área | Ruta |
|------|------|
| Proveedor Evolution | `Back/src/modules/whatsapp/providers/evolution.provider.ts` |
| Fachada + anti-ban | `Back/src/modules/whatsapp/whatsapp.service.ts` |
| Contrato de estados | `Back/src/modules/whatsapp/whatsapp.contract.ts` |
| Rutas HTTP | `Back/src/modules/whatsapp/whatsapp.routes.ts`, `whatsapp.controller.ts` |
| Tenant | `Back/src/middleware/tenantMiddleware.ts`, `Back/src/config/tenant-context.ts` |
| Schema | `Back/prisma/schema.prisma` (`tenant_config`, `message`, `whatsapp_*`) |
| API Front | `Front/lib/api/messages.ts` |
| UI conexión | `Front/app/dashboard/messages/components/WhatsAppConnection.tsx`, `WhatsAppStatus.tsx` |

---

*Documento generado para transferir contexto entre proyectos/agentes. Ajustar URLs, nombres de instancia y versiones de Evolution API según el entorno destino.*
