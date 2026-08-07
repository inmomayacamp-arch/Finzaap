import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../utils/supabase/info'

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
)

const TABLE = 'kv_store_b75840fa'

export async function loadAccount(accountId: string): Promise<any> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('key', `account:${accountId}`)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function saveAccount(accountId: string, payload: any): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key: `account:${accountId}`, value: payload })
  if (error) throw error
}

export function generateAccountId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part(4)}-${part(4)}`
}
