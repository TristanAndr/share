import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function connectPostgres() {
  await prisma.$connect()
  console.log('🐘 PostgreSQL connected')
}
