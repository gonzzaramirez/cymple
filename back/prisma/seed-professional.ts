/**
 * Seed: Profesional independiente
 *
 * Crea UN profesional independiente de demo.
 * Uso: npx ts-node prisma/seed-professional.ts
 *
 * Credenciales generadas:
 *   Email:    test@gmail.com
 *   Password: test123
 *   Slug:     demo  →  acceso en /home
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('test123', 12);

  const professional = await prisma.professional.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      slug: 'demo2',
      fullName: 'Demo Professional',
      email: 'test@gmail.com',
      passwordHash,
      phone: '+5491111111111',
      standardFee: new Prisma.Decimal(25000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  console.log('\n✓ Seed "profesional independiente" completado\n');
  console.log('  Cuenta creada:');
  console.log(`  → Email:    test@gmail.com`);
  console.log(`  → Password: test123`);
  console.log(`  → Slug:     demo2`);
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
