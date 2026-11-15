import type { PersistentAttention } from '../services/PersistentAttention'
export default function AttentionBorder({ attention }: { attention: PersistentAttention | null }) {
  return attention ? <div aria-hidden="true" data-testid="attention-border" className={`attention-border attention-${attention.phase}`} /> : null
}
