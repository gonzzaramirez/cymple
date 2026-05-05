# Plan: Fix Webhook Reception & Patient Reply Processing

## Bug Raíz Confirmado

La URL del webhook en Evolution API era `http://apitest.cymple.online:3080/v1/webhooks/whatsapp` pero el puerto 3080 NO es accesible públicamente. Solo funciona `https://apitest.cymple.online` (puerto 443 con SSL).

**YA CORREGIDO EN PRODUCCIÓN**: La URL del webhook se actualizó a `https://apitest.cymple.online/v1/webhooks/whatsapp` via llamada directa a la Evolution API.

## Cambios de Código Pendientes

### 1. `back/src/whatsapp/evolution-api.service.ts` — Agregar método `setWebhook`

Agregar después del método `sendText`:

```typescript
async setWebhook(
  instanceName: string,
  webhookUrl: string,
): Promise<Record<string, unknown>> {
  return this.request<Record<string, unknown>>(
    'POST',
    `/webhook/set/${encodeURIComponent(instanceName)}`,
    {
      enabled: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: ['MESSAGES_UPSERT'],
      },
    },
  );
}
```

### 2. `back/src/whatsapp/whatsapp-connection.service.ts` — Llamar `setWebhook` después de crear/conectar

Agregar en `start()` y `startOrg()`, después de crear o conectar la instancia, llamar a `setWebhook` para asegurar que la URL siempre esté actualizada:

```typescript
const webhook = this.webhookUrl();
if (webhook) {
  try {
    await this.evolution.setWebhook(instanceName, webhook);
  } catch (e) {
    this.logger.warn(`Failed to set webhook for ${instanceName}: ${e}`);
  }
}
```

Hacer lo mismo en `start()` y `startOrg()`, antes del return final.

### 3. `back/src/webhooks/webhooks.service.ts` — Agregar logging detallado

Mejorar `handleWhatsappPayload()` con logs más descriptivos:
- Loguear payload keys al recibir
- Loguear texto y fromJid cuando se extrae exitosamente
- Loguear warning cuando extractInboundText retorna null

### 4. `back/src/whatsapp/whatsapp-messaging.service.ts` — Fix processPatientReply

**4a**: Cuando `!appointment` (no se encuentra turno futuro), enviar un mensaje de guía al paciente en vez de retornar `false` silenciosamente.

**4b**: Cambiar `startAt: { gte: now }` a `startAt: { gte: gracePeriod }` con un grace period de 2 horas, para permitir respuestas tardías.

**4c**: En la query con `reminderSentAt: { not: null }`, cambiar `orderBy: { reminderSentAt: 'desc' }` a `orderBy: { startAt: 'asc' }` para priorizar el turno más próximo.

### 5. Producción `.env` — Verificar APP_PUBLIC_URL

Asegurarse de que en producción el `.env` tiene:
```
APP_PUBLIC_URL=https://apitest.cymple.online
```

## Resumen de la Causa Raíz

1. **CRÍTICO (YA FIXED)**: La URL del webhook apuntaba a puerto 3080 que no es accesible públicamente. Solo funciona HTTPS en puerto 443.
2. **PREVENTIVO**: El sistema no llamaba `/webhook/set` después de crear/conectar instancias.
3. **MEJORA**: processPatientReply no enviaba guía al paciente si no encontraba turno.
4. **MEJORA**: Las respuestas tardías (>hora de inicio) se descartaban silenciosamente.