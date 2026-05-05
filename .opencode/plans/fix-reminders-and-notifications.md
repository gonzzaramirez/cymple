# Plan: Fix 24h Reminders & Patient Reply Notifications

## Files to Modify

### 1. `back/src/appointments/reminder-sweeper.service.ts`

**Remove permanent abandonment logic (lines 55-93)**: Delete the `errorCount >= 3` block that marks `reminderSentAt = now` and creates `[FATAL]` logs. Replace with a simple warning log. The sweeper will keep retrying every 5 min instead of giving up.

**Current code (lines 49-93):**
```typescript
if (!sent) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const errorCount = await this.prisma.messageLog.count({
    where: {
      appointmentId: appointment.id,
      messageType: 'APPOINTMENT_REMINDER',
      content: { startsWith: '[ERROR]' },
      createdAt: { gte: oneHourAgo },
    },
  });

  if (errorCount >= 3) {
    this.logger.error(
      `Recordatorio ${appointment.id} falló ${errorCount} veces — se cancela reintento`,
    );
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSentAt: now },
    });
    await this.prisma.messageLog.create({
      data: {
        professionalId: appointment.professional.id,
        patientId: appointment.patient.id,
        appointmentId: appointment.id,
        direction: 'OUTBOUND',
        messageType: 'APPOINTMENT_REMINDER',
        toPhone: appointment.patient.phone ?? undefined,
        content:
          '[FATAL] Recordatorio cancelado tras 3 reintentos fallidos',
        sentAt: null,
      },
    });
  } else {
    this.logger.warn(
      `Recordatorio no enviado (intento ${errorCount + 1}/3) ${appointment.id}`,
    );
  }
  continue;
}
```

**Replace with:**
```typescript
if (!sent) {
  this.logger.warn(
    `Recordatorio no enviado para turno ${appointment.id} — se reintentará en el próximo ciclo`,
  );
  continue;
}
```

**Also improve the success log (line 94):**
```typescript
this.logger.log(`Reminder sent for appointment ${appointment.id}`);
```
→ Replace with:
```typescript
this.logger.log(
  `Reminder sent for appointment ${appointment.id} (${appointment.patient.firstName} ${appointment.patient.lastName})`,
);
```

---

### 2. `back/src/whatsapp/whatsapp-messaging.service.ts`

#### 2a. Fix `sendAppointmentReminder` false returns — add descriptive warnings

The method returns `false` silently in several places. Add `this.logger.warn(...)` at each early return:

**Line 255-258:**
```typescript
if (!row) {
  this.logger.warn(
    `Recordatorio: appointment ${appointmentId} no encontrado`,
  );
  return false;
}
```
✅ Already has warning — no change needed.

**Line 263-265:**
```typescript
if (!this.evolution.isConfigured()) {
  this.logger.warn('Recordatorio: Evolution no configurada');
  return false;
}
```
✅ Already has warning — no change needed.

**Line 271-276:**
```typescript
if (!waCtx.isConnected) {
  this.logger.warn(
    `Recordatorio: WA no conectado para profesional ${professional.id} (orgId: ${waCtx.organizationId ?? 'ninguno'})`,
  );
  return false;
}
```
✅ Already has warning — no change needed.

**Line 278-280:**
```typescript
if (!patient.phone) {
  this.logger.warn(`Recordatorio: paciente ${patient.id} sin teléfono`);
  return false;
}
```
✅ Already has warning — no change needed.

**Line 294-299:**
```typescript
if (!tpl.isEnabled) {
  this.logger.warn(
    `Recordatorio: template deshabilitado para profesional ${professional.id}`,
  );
  return false;
}
```
✅ Already has warning — no change needed.

OK — all false-return branches already have descriptive warnings. The issue was that the sweeper didn't log these meaningfully. Fixed in step 1.

#### 2b. Remove WhatsApp notification to professional on confirm/cancel

**Lines 950-961 (confirm):** Remove the block that sends WhatsApp to the professional:
```typescript
const patientName = `${patient.firstName} ${patient.lastName}`;
const notifBody = `${rel ? rel : whenLabel} a las ${time}hs`;
if (professional.phone) {
  void this.sendSystemText({
    professionalId: professional.id,
    patientId: patient.id,
    appointmentId: appointment.id,
    toPhoneDigits: normalizeArWhatsappNumber(professional.phone),
    content: `\u{2705} ${patientName} confirmó su turno de ${notifBody}`,
    organizationId,
  }).catch(() => undefined);
}
```

**Lines 996-1005 (cancel):** Remove the block that sends WhatsApp to the professional:
```typescript
if (professional.phone) {
  void this.sendSystemText({
    professionalId: professional.id,
    patientId: patient.id,
    appointmentId: appointment.id,
    toPhoneDigits: normalizeArWhatsappNumber(professional.phone),
    content: `\u{274C} ${patientName} canceló su turno de ${notifBody}`,
    organizationId,
  }).catch(() => undefined);
}
```

Keep only the in-app notification (`notifications.create(...)`) for both confirm and cancel.

#### 2c. Add `appointmentId` to inbound MessageLog

In `processPatientReply`, the inbound log (lines 848-859) is created before finding the appointment. After finding the appointment (around line 911), add an update to link the log:

**Current code (lines 848-859):**
```typescript
await this.prisma.messageLog.create({
  data: {
    professionalId: professional.id,
    organizationId,
    patientId: patient.id,
    direction: MessageDirection.INBOUND,
    messageType: MessageType.PATIENT_REPLY,
    fromPhone: fromJidDigits,
    content: rawText,
    receivedAt: new Date(),
  },
});
```

**Replace with (store the created log ID):**
```typescript
const inboundLog = await this.prisma.messageLog.create({
  data: {
    professionalId: professional.id,
    organizationId,
    patientId: patient.id,
    direction: MessageDirection.INBOUND,
    messageType: MessageType.PATIENT_REPLY,
    fromPhone: fromJidDigits,
    content: rawText,
    receivedAt: new Date(),
  },
});
```

Then, after `const { appointment } = ...` (when we find the appointment around line 911), add:
```typescript
if (appointment && inboundLog) {
  await this.prisma.messageLog.update({
    where: { id: inboundLog.id },
    data: { appointmentId: appointment.id },
  }).catch(() => {});
}
```

Actually, since the appointment lookup happens inside `processPatientReply` and there's a branch for unrecognized replies, we need to be more careful. Let me look at the flow:

1. Lines 848-859: Create inbound log
2. Lines 862-878: If !isOne && !isTwo, send guidance and return true
3. Lines 884-911: Find appointment
4. Lines 923-973: If confirmed, update status, send ack, create notification
5. Lines 976-1018: If cancelled, update status, send ack, create notification

We need to add appointmentId to the log after finding it. The best place is right after line 911:

```typescript
if (!appointment) return false;

if (inboundLog) {
  await this.prisma.messageLog.update({
    where: { id: inboundLog.id },
    data: { appointmentId: appointment.id },
  }).catch(() => {});
}
```

#### 2d. Fix `.catch(() => undefined)` on notifications

**Lines 962-971 (confirm):**
```typescript
void this.notifications
  .create({
    professionalId: professional.id,
    organizationId,
    type: 'PATIENT_CONFIRMED',
    title: `${patientName} confirmó su turno`,
    body: notifBody,
    link: '/appointments',
  })
  .catch(() => undefined);
```

**Replace with:**
```typescript
void this.notifications
  .create({
    professionalId: professional.id,
    organizationId,
    type: 'PATIENT_CONFIRMED',
    title: `${patientName} confirmó su turno`,
    body: notifBody,
    link: '/appointments',
  })
  .catch((e) =>
    this.logger.error(`Failed to create PATIENT_CONFIRMED notification: ${e}`),
  );
```

**Lines 1006-1015 (cancel):**
```typescript
void this.notifications
  .create({
    professionalId: professional.id,
    organizationId,
    type: 'PATIENT_CANCELLED',
    title: `${patientName} canceló su turno`,
    body: notifBody,
    link: '/appointments',
  })
  .catch(() => undefined);
```

**Replace with:**
```typescript
void this.notifications
  .create({
    professionalId: professional.id,
    organizationId,
    type: 'PATIENT_CANCELLED',
    title: `${patientName} canceló su turno`,
    body: notifBody,
    link: '/appointments',
  })
  .catch((e) =>
    this.logger.error(`Failed to create PATIENT_CANCELLED notification: ${e}`),
  );
```

Also fix the same pattern in other methods:

**Line 127-129 (sendAppointmentCreated):**
```typescript
void this.whatsappMessaging
  .sendAppointmentCreated(created.id)
  .catch(() => undefined);
```
→ Replace with:
```typescript
void this.whatsappMessaging
  .sendAppointmentCreated(created.id)
  .catch((e) =>
    this.logger.error(`Failed to send appointment created WA message: ${e}`),
  );
```

**Lines 134-137 (immediate reminder in appointments.service.ts):**
```typescript
void this.whatsappMessaging
  .sendAppointmentReminder(created.id)
  .catch(() => undefined);
```
→ Replace with:
```typescript
void this.whatsappMessaging
  .sendAppointmentReminder(created.id)
  .catch((e) =>
    this.logger.error(`Failed to send immediate reminder: ${e}`),
  );
```

---

### 3. `back/src/appointments/appointments.service.ts`

#### 3a. Fix immediate reminder fire-and-forget

Add the `Logger` import and inject it if not present, then replace the `.catch(() => undefined)` calls:

**Lines 127-129:**
```typescript
void this.whatsappMessaging
  .sendAppointmentCreated(created.id)
  .catch(() => undefined);
```

**Lines 132-137:**
```typescript
const reminderTime = addMinutes(startAt, -professional.reminderHours * 60);
if (reminderTime <= new Date()) {
  void this.whatsappMessaging
    .sendAppointmentReminder(created.id)
    .catch(() => undefined);
}
```

Both need better error logging. The `AppointmentsService` already has no `Logger` injected. We need to add one or use `console.error`.

Actually, looking at the file again, let me check if there's a Logger in AppointmentsService...
Looking at line 1-6:
```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

There's no `Logger` import. We need to add it.

**Change imports to:**
```typescript
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
```

**Add logger to the service class:**
```typescript
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly notifications: NotificationsService,
  ) {}
```

**Replace lines 127-129:**
```typescript
void this.whatsappMessaging
  .sendAppointmentCreated(created.id)
  .catch(() => undefined);
```
→
```typescript
void this.whatsappMessaging
  .sendAppointmentCreated(created.id)
  .catch((e) =>
    this.logger.error(`Failed to send appointment created message: ${e}`),
  );
```

**Replace lines 132-137:**
```typescript
const reminderTime = addMinutes(startAt, -professional.reminderHours * 60);
if (reminderTime <= new Date()) {
  void this.whatsappMessaging
    .sendAppointmentReminder(created.id)
    .catch(() => undefined);
}
```
→
```typescript
const reminderTime = addMinutes(startAt, -professional.reminderHours * 60);
if (reminderTime <= new Date()) {
  void this.whatsappMessaging
    .sendAppointmentReminder(created.id)
    .catch((e) =>
      this.logger.error(`Failed to send immediate reminder: ${e}`),
    );
}
```

Also check other `.catch(() => undefined)` in the same file...

Actually, I should search for all `.catch(() => undefined)` in the codebase to fix them all.

---

## Summary of Changes

| File | Change | Priority |
|------|--------|----------|
| `reminder-sweeper.service.ts` | Remove FATAL abandonment logic, keep retrying, improve logs | HIGH |
| `whatsapp-messaging.service.ts` | Remove WA to professional on confirm/cancel, add appointmentId to inbound log, fix .catch | HIGH |
| `appointments.service.ts` | Add Logger, fix .catch(() => undefined) calls | MEDIUM |

## NOT Changing (per user request)

- Bug 4: NOT adding WhatsApp notification to center admin — removing the existing WA notification to professional instead (in-app only)
- Bug 5: NOT changing APP_PUBLIC_URL — already correct in production