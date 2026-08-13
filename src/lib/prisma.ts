import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Prisma is the ONLY way SelectIQ touches the database — every query, mutation
 * and migration goes through here. Never use the Supabase client for data
 * access, and never write raw SQL unless explicitly instructed.
 *
 * The global cache prevents Next.js dev-mode hot reloads from opening a new
 * connection pool on every recompile.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
