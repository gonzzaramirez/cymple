/**
 * Seed completo: crea tanto el profesional independiente como el centro médico demo.
 *
 * Para seeds individuales:
 *   npm run prisma:seed:professional  →  solo profesional independiente
 *   npm run prisma:seed:center        →  solo centro + profesionales miembros
 *
 * Uso: npm run prisma:seed  (o: npx prisma db seed)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Profesional independiente ──────────────────────────────────────────
  const indieHash = await bcrypt.hash('test123', 12);

  await prisma.professional.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      slug: 'demo',
      fullName: 'Demo Professional',
      email: 'test@gmail.com',
      passwordHash: indieHash,
      phone: '+5491111111111',
      standardFee: new Prisma.Decimal(25000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  // ── 2. Centro médico ──────────────────────────────────────────────────────
  const orgHash = await bcrypt.hash('centro123', 12);

  const org = await prisma.organization.upsert({
    where: { email: 'centro@demo.com' },
    update: {},
    create: {
      slug: 'centro-demo',
      name: 'Centro Médico Demo',
      email: 'centro@demo.com',
      passwordHash: orgHash,
      phone: '+5491100000000',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  // ── 3. Profesionales miembros del centro ──────────────────────────────────
  const proAHash = await bcrypt.hash('profA123', 12);
  const proBHash = await bcrypt.hash('profB123', 12);

  await prisma.professional.upsert({
    where: { email: 'dra.garcia@demo.com' },
    update: {},
    create: {
      slug: `${org.slug}-dra-garcia`,
      fullName: 'Dra. García',
      email: 'dra.garcia@demo.com',
      passwordHash: proAHash,
      phone: '+5491122222222',
      specialty: 'Clínica Médica',
      organizationId: org.id,
      standardFee: new Prisma.Decimal(8000),
      consultationMinutes: 30,
      bufferMinutes: 10,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  await prisma.professional.upsert({
    where: { email: 'dr.lopez@demo.com' },
    update: {},
    create: {
      slug: `${org.slug}-dr-lopez`,
      fullName: 'Dr. López',
      email: 'dr.lopez@demo.com',
      passwordHash: proBHash,
      phone: '+5491133333333',
      specialty: 'Traumatología',
      organizationId: org.id,
      standardFee: new Prisma.Decimal(10000),
      consultationMinutes: 45,
      bufferMinutes: 15,
      minRescheduleHours: 4,
      reminderHours: 24,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  console.log('\n✓ Seed completo\n');
  console.log('  INDEPENDIENTE (→ /home)');
  console.log('    test@gmail.com  /  test123\n');
  console.log('  CENTRO ADMIN (→ /center/home)');
  console.log('    centro@demo.com  /  centro123\n');
  console.log('  MIEMBROS DEL CENTRO (→ /home, datos filtrados)');
  console.log('    dra.garcia@demo.com  /  profA123');
  console.log('    dr.lopez@demo.com   /  profB123\n');
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
