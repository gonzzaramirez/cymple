import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  await prisma.professional.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      slug: 'consultorio-demo',
      fullName: 'Profesional Demo',
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
