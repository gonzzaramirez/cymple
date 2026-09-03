/**
 * Seed: Nuevo profesional independiente (VPS)
 *
 * Crea un profesional de demo en la VPS.
 * Uso dentro del contenedor:
 *   npx ts-node -r tsconfig-paths/register prisma/seed-professional-vps.ts
 *
 * Credenciales:
 *   Email:    marielgaleano2@gmail.com
 *   Password: mariel202
 *   Slug:     marielgaleano  →  acceso en /home
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('noelia202', 12);

  const professional = await prisma.professional.upsert({
    where: { email: 'noeliaf2092@gmail.com' },
    update: {},
    create: {
      slug: 'noeliafraga',
      fullName: 'Noelia Fraga',
      email: 'noeliaf2092@gmail.com',
      passwordHash,
      phone: '3794064129',
      standardFee: new Prisma.Decimal(25000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      maxSimultaneous: 1,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
      // Public booking
      publicBookingEnabled: true,
      publicBookingSlug: 'NoeliaFraga',
      depositAmount: new Prisma.Decimal(5000),
      depositWindowHours: 24,
      paymentAlias: 'noelia.mp',
      bookingAutoCancel: true,
      maxActiveBookings: 3,
      waPublicBookingPhone: '3794064129',
      intakeEnabled: true,
      depositEnabled: true,
    },
  });

  console.log('\n✓ Seed profesional completado\n');
  console.log('  Cuenta creada:');
  console.log(`  → Email:    noeliaf2092@gmail.com`);
  console.log(`  → Password: noelia202`);
  console.log(`  → Slug:     ${professional.slug}`);
  console.log(`  → ID:       ${professional.id}`);
  console.log('\n  Ingresar en: /login  (redirige a /home)\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
