import { stableHash } from '~/domain/productIdentity'
import type { ExecutionTraceEvent, SearchSession } from '~/types/thread'

export const TELEMETRY_RETENTION_LIMIT = 250

export function appendTrace(
  session: SearchSession,
  event: Omit<ExecutionTraceEvent, 'id' | 'at'> & { at?: string },
): SearchSession {
  const at = event.at ?? new Date().toISOString()
  const next: ExecutionTraceEvent = {
    ...event,
    id: `event:${stableHash(`${session.id}:${session.revision}:${event.type}:${at}:${event.message}`)}`,
    at,
  }
  return {
    ...session,
    telemetry: [...session.telemetry, next].slice(-TELEMETRY_RETENTION_LIMIT),
  }
}
