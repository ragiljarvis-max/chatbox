import { sessionRepository } from '@/app/renderer-application'

/**
 * FASE 10 C: no built-in sample/pinned chats are seeded anymore.
 * The app starts empty; user-created sessions (incl. folders/pins) are untouched.
 */
export async function initData() {
  // intentionally empty — default sample chats removed
}
