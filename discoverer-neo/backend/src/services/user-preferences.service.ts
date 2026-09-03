import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'pt-PT' | 'fr-FR' | 'es-ES';
export type Theme = 'light' | 'dark' | 'high-contrast';
export type ColorPalette = 'default' | 'navy';

export interface UserPreferences {
  locale: Locale;
  theme: Theme;
  colorPalette: ColorPalette;
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPreferences(
  userId: string,
): Promise<UserPreferences> {
  const [row] = await db
    .select({ locale: users.locale, theme: users.theme, colorPalette: users.colorPalette })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw new UserNotFoundError(userId);
  }

  return row;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function updatePreferences(
  userId: string,
  data: { locale?: Locale; theme?: Theme; colorPalette?: ColorPalette },
): Promise<UserPreferences> {
  const [row] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ locale: users.locale, theme: users.theme, colorPalette: users.colorPalette });

  if (!row) {
    throw new UserNotFoundError(userId);
  }

  return row;
}
