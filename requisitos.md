# MedAgenda MVP — Especificación Técnica Completa

> Sistema de gestión de turnos y comunicaciones automatizadas para profesionales de la salud independientes.  
> Stack: Next.js · NestJS · Prisma · PostgreSQL · Evolution API

---

## Índice

1. [Visión General del Producto](#1-visión-general-del-producto)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Modelo de Datos (Prisma Schema)](#3-modelo-de-datos)
4. [Requisitos Funcionales](#4-requisitos-funcionales)
5. [Requisitos No Funcionales](#5-requisitos-no-funcionales)
6. [Stack Técnico y Librerías — Análisis Detallado](#6-stack-técnico-y-librerías)
7. [Módulo Evolution API — Diseño de Integración](#7-módulo-evolution-api)
8. [¿N8N o Evolution API puro? — Análisis de Rentabilidad](#8-n8n-vs-evolution-api)
9. [Flujos de Automatización de Mensajes](#9-flujos-de-automatización)
10. [Módulo Financiero — Diseño](#10-módulo-financiero)
11. [UI/UX — Principios y Componentes Clave](#11-uiux)
12. [Roadmap de Desarrollo MVP](#12-roadmap-mvp)
13. [Riesgos y Consideraciones](#13-riesgos)

---

## 1. Visión General del Producto

### El problema real

Un profesional de salud independiente (psicólogo, nutricionista, kinesiólogo, médico clínico) con agenda propia pierde entre **1.5 y 2.5 horas diarias** en tareas de coordinación pura:

- Enviar confirmación manual al paciente cuando agenda un turno
- Recordar a mano la noche anterior a cada turno
- Responder "¿sigo teniendo turno?" en WhatsApp a medianoche
- Llevar registro de cobros en una libreta o Excel desordenado
- No saber cuánto facturó el mes pasado sin hacer cuentas a mano

Esto no es un problema de organización personal — es ausencia de herramienta adecuada.

### Lo que se construye

Un sistema **minimalista, mobile-first, multi-tenant** que automatiza las comunicaciones con pacientes vía WhatsApp (Evolution API) y centraliza agenda + finanzas en un panel limpio.

### A quién va dirigido (MVP)

- Profesionales individuales o en consultorio compartido
- Sin equipo de IT, sin soporte técnico propio
- Usan el celular entre consulta y consulta
- Tarifa: modelo SaaS mensual por profesional

## 4. Requisitos Funcionales

### RF 1 — Módulo de Configuración del Profesional

**RF 1.01 — Registro y autenticación**
Yo como dev creeo mediante seed el profesional id o consultorio id con nombre slug, email, nombre etc del admin.

**RF 1.02 — Configuración de disponibilidad**

_Esta es la configuración más importante del sistema. Un error aquí afecta a todos los turnos generados. El flujo debe ser guiado, tipo wizard, igual a como lo hace Turnito._

**Paso A — Parámetros de la consulta:**

- Duración de cada consulta (selector: 15, 20, 30, 45, 60 min)
- Tiempo libre entre consultas / buffer (0, 5, 10, 15 min) — _insight de Turnito: es un campo separado, no parte de la duración_. Si la consulta dura 30 min y el buffer es 10 min, el siguiente slot disponible es a los 40 min.
- Mostrar en tiempo real: "Con esta configuración, podés atender X pacientes por hora"

**Paso B — Modo de disponibilidad:**

- **Semanal / Repetitivo** (default): el profesional define qué días y rangos horarios aplican todas las semanas. Ideal para la mayoría.
- **Fechas específicas**: el profesional habilita manualmente cada fecha y su horario. Útil para agendas irregulares o por turnos.
- _Pueden coexistir: base semanal + bloqueos o habilitaciones puntuales por fecha específica._

**Paso C — Rangos horarios (modo semanal):**

- Por cada día habilitado, definir uno o más rangos: [inicio] → [fin]
- Ejemplo real: Lunes `09:00-13:00` Y `15:00-19:00` (dos rangos, no solo inicio/fin global)
- Mostrar feedback inmediato: "X lugares disponibles por día"
- Eliminar rangos individualmente (botón ✕ por rango)
- Agregar rangos adicionales por día (botón "+ Agregar rango")

**Paso D — Regla de reprogramación:**

- Anticipación mínima para que un paciente pueda reprogramar su turno (en horas)
- Ejemplo: con 4 horas de anticipación, un turno a las 19:00 solo puede reprogramarse antes de las 15:00
- Protege al profesional de cancelaciones de último momento
- Default sugerido: 4 horas

**Paso E — Honorario y recordatorio:**

- Honorario por sesión estándar (editable por turno individual)
- Antelación del recordatorio automático (12h, 24h, 48h)

**RF 1.03 — Vinculación de WhatsApp (Evolution API)**

- El sistema debe generar/solicitar un código QR a la instancia Evolution API del profesional
- Mostrar el QR en pantalla para que el profesional lo escanee con su WhatsApp
- Mostrar estado de conexión en tiempo real: Desconectado / Conectando / Conectado
- Permitir desconectar la sesión manualmente
- _Nota MVP: cada profesional usa su propio WhatsApp personal o Business. La VPS con Evolution API corre múltiples instancias (una por profesional)._

---

### RF 2 — Módulo de Gestión de Pacientes

**RF 2.01 — ABM de Pacientes**

- Crear paciente: Nombre (req.), Apellido (req.), Teléfono (req., formato +549...), Email (opc.), Notas privadas (opc.) proponer mas datos para un consultorio tipico, fecha de nacimiento, dni etc
- Editar todos los campos
- Eliminar paciente (soft delete o cascade — definir política; recomendado: bloquear si tiene turnos futuros)
- Validación de teléfono duplicado por profesional

**RF 2.02 — Búsqueda rápida**

- Input de búsqueda con debounce (300ms) sobre nombre, apellido y teléfono
- Resultados en tiempo real sin recarga de página

**RF 2.03 — Historial básico de paciente**

- Listado de todos los turnos del paciente, ordenados por fecha descendente
- Estado visual de cada turno (badge de color)
- Total de sesiones y total facturado al paciente (dato útil para el profesional)

---

### RF 3 — Módulo de Gestión de Agenda

**RF 3.01 — Visualización de calendario**

- Vista diaria: bloques de tiempo del horario configurado, turnos asignados con nombre de paciente
- Vista semanal: columnas por día, bloques por horario
- Vista mensual: resumen por día con contador de turnos y un indicador visual de ocupación (ej: 8/12 lugares)
- Diferenciación visual entre slots: **libre** (disponible para asignar), **ocupado** (turno asignado), **buffer** (tiempo libre post-consulta, no asignable), **bloqueado** (fuera del horario configurado o rango entre bloques del día)
- El calendario respeta la configuración de disponibilidad del profesional, incluyendo múltiples rangos horarios por día

**RF 3.01b — Cálculo de slots disponibles**

La lógica de generación de slots disponibles para un día dado es:

```
Para cada rango horario del día (WeeklySchedule o SpecificDate):
  cursor = startTime del rango
  mientras cursor + slotDuration <= endTime del rango:
    si no hay turno existente solapado:
      agregar slot disponible en cursor
    cursor = cursor + slotDuration + bufferBetweenSlots
```

Ejemplo: rango 09:00-13:00, duración 30 min, buffer 10 min:
→ Slots: 09:00, 09:40, 10:20, 11:00, 11:40, 12:20 (6 slots = "6 lugares disponibles")

**RF 3.02 — Asignación de turno**

- Click en slot vacío → modal de nuevo turno
- Seleccionar paciente existente (búsqueda inline) o crear paciente nuevo en el mismo modal
- Campos: fecha/hora (pre-poblada por el slot), duración, motivo (opcional)
- Al guardar: crea el turno en BD y dispara notificación de alta por WhatsApp

**RF 3.03 — Gestión de estados**

- Botones de acción contextuales según estado actual:
  - PENDING → [Confirmar] [Cancelar]
  - CONFIRMED → [Atendido] [Ausente] [Cancelar]
  - ATTENDED → (solo lectura, ver ingreso)
  - ABSENT → (solo lectura)
- El cambio de estado PENDING/CONFIRMED → ATTENDED crea automáticamente un registro de Revenue

**RF 3.04 — Reprogramación y cancelación**

- El profesional puede siempre reprogramar o cancelar sin restricciones de tiempo
- El paciente (cuando haya autoagenda en v2) solo puede reprogramar con la anticipación mínima configurada (`minRescheduleHours`). Si el turno está dentro de esa ventana, el sistema rechaza la acción e indica el motivo.
- Al reprogramar: envía notificación al paciente con nueva fecha/hora; cancela el job de recordatorio anterior y crea uno nuevo con la nueva fecha
- Al cancelar: envía notificación al paciente, libera el slot, cancela el job de recordatorio pendiente

---

### RF 4 — Módulo de Automatización de Comunicaciones

**RF 4.01 — Notificación de alta**
Al crear un turno, el sistema envía automáticamente:

```
Hola [Nombre]! 🗓️
Te confirmamos tu turno con [Profesional]:
📅 [Día], [DD] de [Mes] a las [HH:MM]hs

¡Te esperamos!
```

**RF 4.02 — Recordatorio programado**

- Se agenda un job en Bull al crear el turno, para dispararse N horas antes (configurable por profesional)
- Si el turno fue cancelado antes del recordatorio, el job se cancela (via `reminderJobId`)
- Mensaje:

```
📋 Recordatorio de turno
Hola [Nombre]! Mañana [o "Hoy"] tenés turno con [Profesional] a las [HH:MM]hs.

Confirmá tu asistencia:
1️⃣ Confirmo que voy
2️⃣ No puedo asistir
```

**RF 4.03 — Procesamiento de respuestas (Webhook)**

- Evolution API envía webhook a `POST /webhooks/whatsapp` cuando llega un mensaje
- El sistema identifica el número de teléfono entrante y busca el turno más próximo PENDING del paciente
- Si responde "1" → estado CONFIRMED, envía acuse: _"✅ ¡Perfecto! Tu turno está confirmado."_
- Si responde "2" → estado CANCELLED, envía acuse: _"Entendido, tu turno fue cancelado. ¡Hasta la próxima!"_
- Cualquier otro mensaje → se ignora (no responder para no generar confusión)
- Log de todas las interacciones en `MessageLog`

**RF 4.04 — Notificación de modificación/cancelación**

- Al reprogramar: notificación con nueva fecha/hora
- Al cancelar por parte del profesional: notificación de cancelación

---

### RF 5 — Módulo Financiero Básico

**RF 5.01 — Registro automático de ingresos**

- Al marcar un turno como "Asistió", el sistema crea automáticamente un registro en `Revenue` con el monto configurado en el perfil del profesional
- El monto puede editarse manualmente si difiere del estándar (ej. descuento, pago parcial)

**RF 5.02 — Registro manual de egresos**

- Formulario simple: Concepto (texto libre), Monto, Fecha
- Listado de egresos recientes del mes

**RF 5.03 — Panel de balance mensual**

- Selector de mes (default: mes actual)
- Métricas visibles:
  - Total Ingresos del mes
  - Total Egresos del mes
  - Balance Neto (Ingresos - Egresos)
  - Cantidad de turnos atendidos
  - Cantidad de ausentes
  - % de ocupación de agenda
- Gráfico de barras sencillo: ingresos vs egresos por semana del mes

---

## 5. Requisitos No Funcionales

### RNF 1 — Multi-tenancy

**Estrategia: Row-Level Multi-tenancy**

- Todas las tablas de negocio tienen `professionalId` (FK a `Professional`)
- NestJS: un `TenantGuard` que extrae el `professionalId` del JWT y lo inyecta en cada request vía `REQUEST` scope
- Todos los queries de Prisma incluyen `where: { professionalId }` obligatoriamente — nunca un query sin este filtro en entidades sensibles
- En producción escalar: considerar PostgreSQL Row Level Security (RLS) como segunda capa

```typescript
// tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.professionalId = req.user.sub; // sub del JWT = professionalId
    return true;
  }
}
```

### RNF 2 — UI/UX Minimalista y Mobile-First

usar skill de diseño pero:

- **Sin tablas de datos** en móvil: usar tarjetas (cards) con la info clave visible
- sidebar a la izquierda minimalista simple

### RNF 3 — Rendimiento

- Time to First Byte < 200ms (API)
- Infinite scroll o paginación en listados > 20 ítems

### RNF 4 — Seguridad

- Passwords: `bcrypt` con cost factor 12
- JWT:
- Rate limiting: `@nestjs/throttler` — 100 req/min por IP, 10 req/min en endpoints de auth
- Webhook de Evolution API: verificar header secreto `x-evolution-webhook-token`
- Variables de entorno: nunca credenciales en código — validación con `@nestjs/config` + Joi

## 6. Stack Técnico y Librerías

| **`react-hook-form` + `zod`** | Formularios con validación tipada. `zod` para el schema compartido entre frontend y backend. Sin validación duplicada. |
| **`@fullcalendar/react`** | El calendario más completo para React. Tiene vistas day/week/month, drag&drop, click en slots. Customizable con CSS. Ahorrás 3 semanas de desarrollo de un calendario custom. |
| **`dayjs** |
| **`lucide-react`** | Iconos SVG limpios, coherentes. Mismo look que shadcn/ui. |
| **`recharts`** | Gráficos para el panel financiero. Simple, basado en SVG, funciona bien con Tailwind. |
| https://www.luxeui.com/ui/
| **`nuqs`** | Sincronizar estado de UI con URL params (ej: mes seleccionado en finanzas, fecha del calendario). Mejora UX con deep linking. |
| usar toast https://sileo.aaryan.design/|

### Backend (NestJS)

| Librería                                    | Por qué usarla                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@nestjs/jwt` + `passport-jwt`**          | Auth JWT estándar. Guards de NestJS para proteger rutas.                                                                                                                                    |
| **`@nestjs/throttler`**                     | Rate limiting declarativo con decoradores.                                                                                                                                                  |
| **`@nestjs/bull` + `bull` + `ioredis`**     | Cola de jobs para los recordatorios programados. **Crítico**: los recordatorios no pueden correr en un `setTimeout` porque si el servidor reinicia, se pierden. Bull los persiste en Redis. |
| **`node-cron`**                             | Cron job para el "sweeper": revisar cada 5 minutos si hay recordatorios que deberían haberse enviado (fallback de seguridad a Bull).                                                        |
| **`pino` + `nestjs-pino`**                  | Logging performante y estructurado (JSON). Mejor que Winston para producción.                                                                                                               |
| **`@nestjs/config` + `joi`**                | Validación de variables de entorno al arrancar. Si falta una env var crítica, el servidor no inicia (fail-fast).                                                                            |
| **`resend`**                                | Emails transaccionales (errores de WhatsApp, bienvenida al profesional). Mejor DX que Nodemailer. Plan gratuito generoso.                                                                   |
| **`bcrypt`**                                | Hash de passwords. Standard.                                                                                                                                                                |
| **`class-validator` + `class-transformer`** | Validación de DTOs con decoradores en NestJS.                                                                                                                                               |

#

## 7. Módulo Evolution API

### Diseño del EvolutionApiService (NestJS)

```typescript
// evolution-api.service.ts

@Injectable()
export class EvolutionApiService {
  private readonly baseUrl: string;
  private readonly globalApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = configService.get("EVOLUTION_API_URL"); // https://tu-vps.com:8080
    this.globalApiKey = configService.get("EVOLUTION_API_KEY"); // global key
  }

  // ── Gestión de instancias ──────────────────────────────────────

  async createInstance(
    professionalId: string,
  ): Promise<{ instanceName: string }> {
    // Una instancia por profesional: nombre = "prof_${professionalId}"
    const instanceName = `prof_${professionalId}`;
    await axios.post(
      `${this.baseUrl}/instance/create`,
      {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: `${this.configService.get("APP_URL")}/webhooks/whatsapp`,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          webhook_by_events: false,
        },
      },
      { headers: { apikey: this.globalApiKey } },
    );
    return { instanceName };
  }

  async getQRCode(instanceName: string): Promise<string> {
    const res = await axios.get(
      `${this.baseUrl}/instance/connect/${instanceName}`,
      { headers: { apikey: this.globalApiKey } },
    );
    return res.data.base64; // base64 del QR
  }

  async getConnectionStatus(instanceName: string): Promise<WaStatus> {
    const res = await axios.get(
      `${this.baseUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: this.globalApiKey } },
    );
    const state = res.data.instance?.state;
    if (state === "open") return WaStatus.CONNECTED;
    if (state === "connecting") return WaStatus.CONNECTING;
    return WaStatus.DISCONNECTED;
  }

  async logoutInstance(instanceName: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/instance/logout/${instanceName}`, {
      headers: { apikey: this.globalApiKey },
    });
  }

  // ── Envío de mensajes ─────────────────────────────────────────

  async sendTextMessage(
    instanceName: string,
    to: string, // formato: "5493794123456" (sin +)
    text: string,
  ): Promise<void> {
    await axios.post(
      `${this.baseUrl}/message/sendText/${instanceName}`,
      { number: to, text },
      { headers: { apikey: this.globalApiKey } },
    );
  }
}
```

### Webhook Handler

```typescript
// whatsapp-webhook.controller.ts

@Controller("webhooks")
export class WhatsAppWebhookController {
  @Post("whatsapp")
  @UseGuards(WebhookSecretGuard) // valida header x-evolution-webhook-token
  async handle(@Body() payload: any) {
    if (payload.event === "messages.upsert") {
      const message = payload.data?.messages?.[0];
      if (!message?.key?.fromMe && message?.message?.conversation) {
        const fromNumber = message.key.remoteJid.replace("@s.whatsapp.net", "");
        const text = message.message.conversation.trim();
        await this.appointmentService.processPatientReply(fromNumber, text);
      }
    }

    if (payload.event === "connection.update") {
      const instanceName = payload.instance;
      const status = payload.data?.state;
      await this.professionalService.updateWaStatus(instanceName, status);
    }

    return { status: "ok" };
  }
}
```

### Procesamiento de respuestas del paciente

```typescript
async processPatientReply(phone: string, text: string): Promise<void> {
  // Normalizar el número (puede venir con o sin 549)
  const normalizedPhone = this.normalizePhone(phone);

  // Buscar turno próximo PENDING o CONFIRMED del paciente
  const appointment = await this.prisma.appointment.findFirst({
    where: {
      patient: { phone: normalizedPhone },
      status: { in: ['PENDING', 'CONFIRMED'] },
      date: { gte: new Date() }
    },
    orderBy: { date: 'asc' },
    include: { patient: true, professional: true }
  });

  if (!appointment) return; // no hay turno activo, ignorar

  const instanceName = `prof_${appointment.professionalId}`;

  if (text === '1') {
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CONFIRMED' }
    });
    await this.evolutionApi.sendTextMessage(
      instanceName,
      phone,
      `✅ ¡Perfecto, ${appointment.patient.firstName}! Tu turno del ${format(appointment.date, "dd/MM 'a las' HH:mm")}hs está confirmado.`
    );
  } else if (text === '2') {
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' }
    });
    // Cancelar el job de recordatorio si existe
    if (appointment.reminderJobId) {
      await this.reminderQueue.removeJob(appointment.reminderJobId);
    }
    await this.evolutionApi.sendTextMessage(
      instanceName,
      phone,
      `Entendido, ${appointment.patient.firstName}. Tu turno fue cancelado. ¡Hasta la próxima! 👋`
    );
  }
  // Cualquier otro texto: no responder
}
```

---

#

## 11. UI/UX

### Principios de diseño (resumen ejecutivo)

1. **Una acción principal por pantalla** — el CTA más importante debe ser el botón más obvio
2. **Bottom navigation en móvil** — 4 tabs: Agenda / Pacientes / Finanzas / Perfil
3. **Bottom sheets en lugar de modales** — los formularios aparecen desde abajo en móvil
4. **Estados vacíos** — ilustración + texto claro + CTA cuando no hay datos

### Diseño del flujo de onboarding (crítico para conversión)

El onboarding debe completarse en menos de 3 minutos para que el profesional llegue a su primer turno de prueba. Seguir el patrón de Turnito: wizard guiado, una pregunta a la vez, sin formularios largos.

```
Paso 1/5: Tus datos básicos
  → Nombre, Especialidad

Paso 2/5: Tu consulta
  → "¿Cuánto dura cada consulta?" (selector visual: 15/20/30/45/60 min)
  → "¿Hay tiempo libre entre consultas?" (selector: 0/5/10/15 min)
  → Preview en tiempo real: "Con esta config podés atender N pacientes por hora"

Paso 3/5: Tu disponibilidad
  → Toggle: Semanal / Fechas específicas
  → Si Semanal: checkboxes de días + rangos horarios por día
    - Agregar múltiples rangos por día (ej: mañana + tarde)
    - Feedback: "X lugares disponibles el Lunes"
  → Anticipación mínima para reprogramar (selector: 2/4/8/24 horas)

Paso 4/5: Tu honorario y recordatorio
  → Honorario por sesión
  → Cuándo enviar el recordatorio (12h/24h/48h antes)

Paso 5/5: Conectar WhatsApp
  → QR code
  → "Tu sistema ya está listo para enviar mensajes"
  → Opción: "Saltar por ahora, configurar después"
```
