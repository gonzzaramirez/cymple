import { ReminderSweeper } from './reminder-sweeper.service';

const TZ = 'America/Argentina/Buenos_Aires';

function buildSweeper(opts: {
  candidateIds: string[];
  claimed: Array<{ id: string; reminderAttempts: number }>;
  outcomes: Record<string, any>;
}) {
  const prismaMock: any = {
    appointment: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(opts.candidateIds.map((id) => ({ id })))
        .mockResolvedValueOnce(
          opts.claimed.map((c) => ({
            ...c,
            professional: { timezone: TZ },
          })),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const whatsappMock: any = {
    sendAppointmentReminder: jest.fn((id: string) => {
      const outcome = opts.outcomes[id];
      if (!outcome) throw new Error(`sin outcome mockeado para ${id}`);
      if (outcome.throw) throw new Error(outcome.throw);
      return Promise.resolve(outcome);
    }),
    sendPaymentReminder: jest.fn(),
  };

  const notificationsMock: any = { create: jest.fn() };

  const service = new ReminderSweeper(
    prismaMock,
    whatsappMock,
    notificationsMock,
  );
  return { service, prismaMock, whatsappMock };
}

describe('ReminderSweeper', () => {
  it('un item que falla no frena el resto del lote', async () => {
    const { service, prismaMock, whatsappMock } = buildSweeper({
      candidateIds: ['a', 'b'],
      claimed: [
        { id: 'a', reminderAttempts: 0 },
        { id: 'b', reminderAttempts: 0 },
      ],
      outcomes: {
        a: { status: 'failed', reason: 'boom' },
        b: { status: 'sent' },
      },
    });

    await service.checkPendingReminders();

    // Los dos se intentaron aunque el primero falló.
    expect(whatsappMock.sendAppointmentReminder).toHaveBeenCalledTimes(2);
    expect(whatsappMock.sendAppointmentReminder).toHaveBeenNthCalledWith(
      1,
      'a',
    );
    expect(whatsappMock.sendAppointmentReminder).toHaveBeenNthCalledWith(
      2,
      'b',
    );

    const updates = prismaMock.appointment.updateMany.mock.calls.map(
      (c: any[]) => c[0],
    );
    // 1 claim + 2 outcomes.
    expect(updates).toHaveLength(3);

    // 'b' quedó marcado como enviado y sin lock.
    const sentUpdate = updates.find((u: any) => u.where?.id === 'b');
    expect(sentUpdate.data.reminderSentAt).toBeInstanceOf(Date);
    expect(sentUpdate.data.reminderClaimId).toBeNull();

    // 'a' quedó con backoff (reprogramado a futuro) y error visible.
    const failedUpdate = updates.find((u: any) => u.where?.id === 'a');
    expect(failedUpdate.data.reminderScheduledFor.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(failedUpdate.data.reminderLastError).toBe('boom');
    expect(failedUpdate.data.reminderClaimId).toBeNull();
  });

  it('skipped permanente se marca y deferred transitorio reprograma con backoff', async () => {
    const { service, prismaMock, whatsappMock } = buildSweeper({
      candidateIds: ['c', 'd'],
      claimed: [
        { id: 'c', reminderAttempts: 0 },
        { id: 'd', reminderAttempts: 2 },
      ],
      outcomes: {
        c: { status: 'skipped', reason: 'no-phone' },
        d: { status: 'deferred', reason: 'not-connected' },
      },
    });

    await service.checkPendingReminders();

    expect(whatsappMock.sendAppointmentReminder).toHaveBeenCalledTimes(2);

    const updates = prismaMock.appointment.updateMany.mock.calls.map(
      (c: any[]) => c[0],
    );
    expect(updates).toHaveLength(3);

    // 'c' no se reintenta más en silencio: queda marcado.
    const skipped = updates.find((u: any) => u.where?.id === 'c');
    expect(skipped.data.reminderSkippedAt).toBeInstanceOf(Date);
    expect(skipped.data.reminderLastError).toBe('no-phone');

    // 'd' se reprograma ~15 min (backoff) en vez de reintentarse cada tick.
    const deferred = updates.find((u: any) => u.where?.id === 'd');
    const backoffMs =
      deferred.data.reminderScheduledFor.getTime() - Date.now();
    expect(backoffMs).toBeGreaterThan(10 * 60 * 1000);
    expect(backoffMs).toBeLessThanOrEqual(16 * 60 * 1000);
    expect(deferred.data.reminderSentAt).toBeUndefined();
  });

  it('un throw no controlado en un item tampoco aborta el lote', async () => {
    const { service, whatsappMock } = buildSweeper({
      candidateIds: ['e', 'f'],
      claimed: [
        { id: 'e', reminderAttempts: 0 },
        { id: 'f', reminderAttempts: 0 },
      ],
      outcomes: {
        e: { throw: 'explosión' },
        f: { status: 'sent' },
      },
    });

    await service.checkPendingReminders();

    expect(whatsappMock.sendAppointmentReminder).toHaveBeenCalledTimes(2);
  });
});
