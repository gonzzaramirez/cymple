import { PrismaService } from '../common/prisma/prisma.service';

export async function generateBookingToken(
  prisma: PrismaService,
  professionalId: string,
): Promise<string> {
  const count = await prisma.publicBooking.count({
    where: { professionalId },
  });
  return `R-${String(count + 1).padStart(3, '0')}`;
}

export function extractBookingToken(text: string): string | null {
  const match = text.match(/R-(\d+)/i);
  return match ? match[0].toUpperCase() : null;
}
