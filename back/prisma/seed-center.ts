/**
 * Seed: Centro médico con profesionales miembros
 *
 * Crea UN centro médico de demo y dos profesionales asociados.
 * Los profesionales adicionales se crean desde el panel del centro
 * en /center/professionals → "Nuevo profesional".
 *
 * Uso: npx ts-node prisma/seed-center.ts
 *
 * Credenciales generadas:
 *   Centro admin → centro@demo.com  / centro123  (slug: centro-demo)
 *   Profesional A → dra.garcia@demo.com / profA123
 *   Profesional B → dr.lopez@demo.com  / profB123
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Crear el centro (Organization) ────────────────────────────────────
  const orgPasswordHash = await bcrypt.hash('centro123', 12);

  const org = await prisma.organization.upsert({
    where: { email: 'centro@demo.com' },
    update: {},
    create: {
      slug: 'centro-demo',
      name: 'Centro Médico Demo',
      email: 'centro@demo.com',
      passwordHash: orgPasswordHash,
      phone: '+5491100000000',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  console.log(`\n✓ Centro creado: ${org.name}  (id: ${org.id})`);

  // ── 2. Crear profesionales miembros del centro ────────────────────────────
  // Nota: en producción estos se crean desde el panel del centro
  // en /center/professionals. Aquí se crean para demo/testing.

  const proAHash = await bcrypt.hash('profA123', 12);
  const proBHash = await bcrypt.hash('profB123', 12);

  const profA = await prisma.professional.upsert({
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

  const profB = await prisma.professional.upsert({
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

  console.log(`✓ Profesional A: ${profA.fullName}  (id: ${profA.id})`);
  console.log(`✓ Profesional B: ${profB.fullName}  (id: ${profB.id})`);

  console.log('\n─────────────────────────────────────────────────');
  console.log('  CREDENCIALES DE ACCESO');
  console.log('─────────────────────────────────────────────────');
  console.log('  Centro admin (→ /center/home):');
  console.log('    Email:    centro@demo.com');
  console.log('    Password: centro123');
  console.log('    Slug:     centro-demo');
  console.log('');
  console.log('  Profesional A (→ /home  filtrado por sus turnos):');
  console.log('    Email:    dra.garcia@demo.com');
  console.log('    Password: profA123');
  console.log('');
  console.log('  Profesional B (→ /home  filtrado por sus turnos):');
  console.log('    Email:    dr.lopez@demo.com');
  console.log('    Password: profB123');
  console.log('─────────────────────────────────────────────────\n');
  console.log('  Para agregar más profesionales al centro, ingresá');
  console.log('  como centro admin y usá /center/professionals.\n');
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
