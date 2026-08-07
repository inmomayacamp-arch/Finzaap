import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Home, ArrowDownCircle, ArrowUpCircle, BarChart2, PiggyBank, User,
  TrendingUp, TrendingDown, RefreshCw, CreditCard, Banknote,
  Bell, AlertCircle, X, Check, Plus, ChevronLeft, ChevronRight, FileDown,
  Copy, Wifi, WifiOff, LogOut, Users,
} from 'lucide-react'
import { loadAccount, saveAccount, generateAccountId } from './syncApi'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

type TxType = 'income' | 'expense'
type NavTab = 'inicio' | 'pagos-hacer' | 'pagos-cobrar' | 'reporte' | 'ahorro' | 'cuenta'

interface Transaction {
  id: string; type: TxType; description: string; amount: number
  date: string; tag: string; method: 'tarjeta' | 'efectivo'; nota: string; recurrente: boolean
  createdBy?: string
}
interface Pending {
  id: string; type: 'hacer' | 'cobrar'; description: string; amount: number
  dueDate: string; tag: string; nota: string; recordatorio: string
  createdBy?: string
}
interface SavingCategory { id: string; name: string; goal: number; emoji: string }
interface Saving {
  id: string; categoryId: string; amount: number
  date: string; method: 'tarjeta' | 'efectivo'; nota: string
  createdBy?: string
}
interface Recurring { id: string; type: TxType; description: string; amount: number; tag: string; method: 'tarjeta' | 'efectivo' }
interface RecurringCobro { id: string; description: string; amount: number; nota: string }
interface RecurringHacer { id: string; description: string; amount: number; nota: string }

const INIT_TXS: Transaction[] = [
  { id: '1', type: 'income', description: 'Salario mensual', amount: 42000, date: '2026-08-01', tag: 'Trabajo', method: 'tarjeta', nota: '', recurrente: true },
  { id: '2', type: 'income', description: 'Proyecto freelance', amount: 8500, date: '2026-08-03', tag: 'Freelance', method: 'tarjeta', nota: 'Cliente Acme', recurrente: false },
  { id: '3', type: 'income', description: 'Dividendos GBM', amount: 1800, date: '2026-07-28', tag: 'Inversiones', method: 'tarjeta', nota: '', recurrente: false },
  { id: '4', type: 'expense', description: 'Renta departamento', amount: 12000, date: '2026-08-05', tag: 'Vivienda', method: 'tarjeta', nota: '', recurrente: true },
  { id: '5', type: 'expense', description: 'Supermercado', amount: 3200, date: '2026-08-06', tag: 'Alimentación', method: 'efectivo', nota: 'Walmart', recurrente: false },
  { id: '6', type: 'expense', description: 'Netflix + Spotify', amount: 480, date: '2026-08-02', tag: 'Entretenimiento', method: 'tarjeta', nota: '', recurrente: true },
  { id: '7', type: 'expense', description: 'Gasolina', amount: 1100, date: '2026-08-04', tag: 'Transporte', method: 'efectivo', nota: '', recurrente: false },
  { id: '8', type: 'expense', description: 'Gym', amount: 650, date: '2026-07-30', tag: 'Salud', method: 'efectivo', nota: '', recurrente: true },
]
const INIT_PENDING: Pending[] = [
  { id: 'p1', type: 'hacer', description: 'Seguro de auto', amount: 3800, dueDate: '2026-08-12', tag: 'Seguros', nota: '', recordatorio: '2026-08-10' },
  { id: 'p2', type: 'hacer', description: 'Tarjeta de crédito', amount: 7500, dueDate: '2026-08-18', tag: 'Deudas', nota: 'BBVA Azul', recordatorio: '' },
  { id: 'p3', type: 'hacer', description: 'Internet Telmex', amount: 599, dueDate: '2026-08-22', tag: 'Servicios', nota: '', recordatorio: '' },
  { id: 'p4', type: 'cobrar', description: 'Pago cliente Acme', amount: 15000, dueDate: '2026-08-15', tag: 'Freelance', nota: 'Proyecto web', recordatorio: '2026-08-13' },
  { id: 'p5', type: 'cobrar', description: 'Devolución IMSS', amount: 2200, dueDate: '2026-08-20', tag: 'Gobierno', nota: '', recordatorio: '' },
]
const INIT_SAVING_CATS: SavingCategory[] = [
  { id: 'cat1', name: 'Fondo de emergencia', goal: 30000, emoji: '🛡️' },
  { id: 'cat2', name: 'Viaje a Europa', goal: 50000, emoji: '✈️' },
  { id: 'cat3', name: 'Auto nuevo', goal: 150000, emoji: '🚗' },
]
const INIT_SAVINGS: Saving[] = [
  { id: 's1', categoryId: 'cat1', amount: 5000, date: '2026-08-01', method: 'tarjeta', nota: '' },
  { id: 's2', categoryId: 'cat1', amount: 3000, date: '2026-08-03', method: 'efectivo', nota: '' },
  { id: 's3', categoryId: 'cat2', amount: 8000, date: '2026-08-05', method: 'tarjeta', nota: 'Primer depósito' },
  { id: 's4', categoryId: 'cat3', amount: 10000, date: '2026-08-06', method: 'tarjeta', nota: '' },
]
const INIT_RECURRING_HACER: RecurringHacer[] = [
  { id: 'rh1', description: 'Renta departamento', amount: 12000, nota: '' },
  { id: 'rh2', description: 'Tarjeta de crédito', amount: 7500, nota: 'BBVA Azul' },
  { id: 'rh3', description: 'Internet Telmex', amount: 599, nota: '' },
]
const INIT_RECURRING_COBRO: RecurringCobro[] = [
  { id: 'rc1', description: 'Mensualidad cliente Acme', amount: 15000, nota: 'Proyecto web' },
  { id: 'rc2', description: 'Renta local', amount: 8000, nota: '' },
]
const INIT_RECURRING: Recurring[] = [
  { id: 'r1', type: 'income', description: 'Salario mensual', amount: 42000, tag: 'Trabajo', method: 'tarjeta' },
  { id: 'r2', type: 'expense', description: 'Renta departamento', amount: 12000, tag: 'Vivienda', method: 'tarjeta' },
  { id: 'r3', type: 'expense', description: 'Netflix + Spotify', amount: 480, tag: 'Entretenimiento', method: 'tarjeta' },
  { id: 'r4', type: 'expense', description: 'Gym', amount: 650, tag: 'Salud', method: 'efectivo' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const PIE_COLORS = ['#6366f1', '#a78bfa', '#c4b5fd', '#818cf8', '#ddd6fe']
const INCOME_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']

const tagEmoji: Record<string, string> = {
  'Trabajo': '💼', 'Alimentación': '🛒', 'Vivienda': '🏠', 'Transporte': '🚗',
  'Salud': '💪', 'Entretenimiento': '🎬', 'Inversiones': '📈', 'Freelance': '💻',
  'Seguros': '🛡️', 'Deudas': '💳', 'Servicios': '⚡', 'Gobierno': '🏛️',
}
const getEmoji = (tag: string) => tagEmoji[tag] || '📌'

const sh = { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 8px rgba(0,0,0,0.04)' }

const BADGE_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e']
const badgeColorMap: Record<string, string> = {}
function badgeColor(name: string) {
  if (!badgeColorMap[name]) badgeColorMap[name] = BADGE_PALETTE[Object.keys(badgeColorMap).length % BADGE_PALETTE.length]
  return badgeColorMap[name]
}
function UserBadge({ name }: { name: string }) {
  const c = badgeColor(name)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: c + '18', borderRadius: 6, padding: '1px 6px', flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: c }}>{name}</span>
    </span>
  )
}

function UserSetup({ onDone }: { onDone: (name: string, id: string) => void }) {
  const [step, setStep] = useState<'name' | 'action' | 'join'>('name')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = () => {
    onDone(name.trim(), generateAccountId())
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) { setError('Ingresa el código completo'); return }
    setLoading(true); setError('')
    try {
      const data = await loadAccount(code)
      if (!data) { setError('Cuenta no encontrada. Verifica el código.'); setLoading(false); return }
      onDone(name.trim(), code)
    } catch { setError('Error al conectar. Intenta de nuevo.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0f2f5,#e8eaf0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 28, padding: '36px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Users size={24} color="#fff" />
        </div>

        {step === 'name' && <>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#0f1117', marginBottom: 6 }}>¿Cómo te llamas?</div>
          <div style={{ fontSize: 13, color: '#a8b0bf', marginBottom: 24 }}>Tu nombre aparecerá en cada registro que hagas</div>
          <input autoFocus placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('action')}
            style={{ width: '100%', border: '1.5px solid #eef0f4', borderRadius: 12, padding: '13px 16px', fontSize: 15, outline: 'none', color: '#0f1117', boxSizing: 'border-box', marginBottom: 14 }} />
          <button onClick={() => name.trim() && setStep('action')} disabled={!name.trim()}
            style={{ width: '100%', background: name.trim() ? '#6366f1' : '#e5e7eb', border: 'none', borderRadius: 14, color: name.trim() ? '#fff' : '#a8b0bf', padding: '14px', fontWeight: 700, fontSize: 15, cursor: name.trim() ? 'pointer' : 'default' }}>
            Continuar
          </button>
        </>}

        {step === 'action' && <>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#0f1117', marginBottom: 6 }}>Hola, {name} 👋</div>
          <div style={{ fontSize: 13, color: '#a8b0bf', marginBottom: 24 }}>¿Crear cuenta nueva o unirte a una existente?</div>
          <button onClick={handleCreate}
            style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
            Crear cuenta nueva
          </button>
          <button onClick={() => setStep('join')}
            style={{ width: '100%', background: '#f8fafc', border: '1.5px solid #eef0f4', borderRadius: 14, color: '#374151', padding: '14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            Unirme a una cuenta
          </button>
          <button onClick={() => setStep('name')} style={{ background: 'none', border: 'none', color: '#a8b0bf', fontSize: 13, cursor: 'pointer', marginTop: 10, width: '100%' }}>← Cambiar nombre</button>
        </>}

        {step === 'join' && <>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#0f1117', marginBottom: 6 }}>Unirse a cuenta</div>
          <div style={{ fontSize: 13, color: '#a8b0bf', marginBottom: 24 }}>Pide el código de 8 caracteres a quien ya tiene la cuenta</div>
          <input autoFocus placeholder="XXXX-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            style={{ width: '100%', border: `1.5px solid ${error ? '#ef4444' : '#eef0f4'}`, borderRadius: 12, padding: '13px 16px', fontSize: 17, outline: 'none', color: '#0f1117', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textAlign: 'center', boxSizing: 'border-box', marginBottom: 6 }} />
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, textAlign: 'center' }}>{error}</div>}
          <button onClick={handleJoin} disabled={loading}
            style={{ width: '100%', background: '#6366f1', border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10, marginTop: error ? 0 : 8 }}>
            {loading ? 'Buscando...' : 'Unirme'}
          </button>
          <button onClick={() => { setStep('action'); setError('') }} style={{ background: 'none', border: 'none', color: '#a8b0bf', fontSize: 13, cursor: 'pointer', width: '100%' }}>← Volver</button>
        </>}
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const PieTip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #eef0f4', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, color: '#0f1117' }}>{payload[0].name}</div>
      <div style={{ color: '#68717f', fontFamily: 'DM Mono, monospace' }}>{fmt(payload[0].value)}</div>
    </div>
  )
}

// ── Mini donut ────────────────────────────────────────────────────────────────
function DistribucionCard({ expByTag, incByTag }: { expByTag: { name: string; value: number }[]; incByTag: { name: string; value: number }[] }) {
  const [tab, setTab] = useState<'exp' | 'inc'>('exp')
  const data = tab === 'exp' ? expByTag : incByTag
  const colors = tab === 'exp' ? PIE_COLORS : INCOME_COLORS
  const total = data.reduce((s, d) => s + d.value, 0)
  const accentColor = tab === 'exp' ? '#6366f1' : '#10b981'

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: '#f5f6f8', borderRadius: 10, padding: 4 }}>
        {[['exp', 'Egresos'] as const, ['inc', 'Ingresos'] as const].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: tab === val ? '#fff' : 'transparent', color: tab === val ? '#0f1117' : '#a8b0bf', boxShadow: tab === val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#a8b0bf', fontSize: 13, padding: '24px 0' }}>Sin datos aún</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Chart with center label */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart width={180} height={180}>
              <Pie data={data} cx={90} cy={90} innerRadius={52} outerRadius={82} dataKey="value" strokeWidth={2} stroke="#fff" paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip content={<PieTip />} />
            </PieChart>
            {/* Center overlay */}
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 10, color: '#a8b0bf', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tab === 'exp' ? 'Egresos' : 'Ingresos'}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 600, color: accentColor, lineHeight: 1.2, marginTop: 2 }}>{fmt(total)}</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.slice(0, 5).map((d, i) => {
              const pct = total > 0 ? (d.value / total) * 100 : 0
              return (
                <div key={d.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, color: '#a8b0bf', fontFamily: 'DM Mono', marginRight: 6 }}>{pct.toFixed(0)}%</span>
                    <span style={{ fontSize: 13, color: '#0f1117', fontFamily: 'DM Mono', fontWeight: 500 }}>{fmt(d.value)}</span>
                  </div>
                  <div style={{ height: 3, background: '#f5f6f8', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared label style ────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = { fontSize: 11, color: '#a8b0bf', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }

// ── Month strip ───────────────────────────────────────────────────────────────
function MonthStrip({ selected, onChange, accent, pendings }: {
  selected: string; onChange: (m: string) => void; accent: string
  pendings: { dueDate: string; amount: number }[]
}) {
  const months: string[] = []
  const now = new Date()
  for (let i = -3; i <= 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
      {months.map(ym => {
        const active = ym === selected
        const [y, m] = ym.split('-')
        const d = new Date(+y, +m - 1, 1)
        const shortMonth = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
        const total = pendings.filter(p => p.dueDate.startsWith(ym)).reduce((s, p) => s + p.amount, 0)
        const count = pendings.filter(p => p.dueDate.startsWith(ym)).length
        return (
          <button key={ym} onClick={() => onChange(ym)} style={{
            flexShrink: 0, background: active ? accent : '#fff',
            border: `1.5px solid ${active ? accent : '#eef0f4'}`,
            borderRadius: 14, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', minWidth: 90,
            boxShadow: active ? `0 4px 12px ${accent}33` : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: active ? 'rgba(255,255,255,0.8)' : '#a8b0bf', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {shortMonth} {y}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: active ? '#fff' : (count > 0 ? '#0f1117' : '#a8b0bf') }}>
              {count > 0 ? fmt(total) : '—'}
            </div>
            {count > 0 && <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : '#a8b0bf', marginTop: 2 }}>{count} {count === 1 ? 'pago' : 'pagos'}</div>}
          </button>
        )
      })}
    </div>
  )
}

// ── Modal Agregar Transacción ─────────────────────────────────────────────────
function AddModal({ defaultType, recurring, onAdd, onAddRecurring, onClose }: {
  defaultType: TxType; recurring: Recurring[]
  onAdd: (t: Transaction) => void; onAddRecurring: (r: Recurring) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    type: defaultType, description: '', amount: '',
    date: new Date().toISOString().slice(0, 10),
    tag: '', method: 'efectivo' as 'tarjeta' | 'efectivo',
    nota: '', recurrente: false,
  })
  const [showRecurring, setShowRecurring] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const myRecurring = recurring.filter(r => r.type === form.type)
  const applyRecurring = (r: Recurring) => {
    setForm(f => ({ ...f, description: r.description, amount: String(r.amount), tag: r.tag, method: r.method }))
    setShowRecurring(false)
  }
  const submit = () => {
    if (!form.description.trim() || !form.amount) return
    onAdd({ id: Date.now().toString(), type: form.type, description: form.description, amount: parseFloat(form.amount), date: form.date, tag: form.tag || 'General', method: form.method, nota: form.nota, recurrente: form.recurrente })
    if (form.recurrente && !recurring.find(r => r.description === form.description && r.type === form.type)) {
      onAddRecurring({ id: 'rec_' + Date.now(), type: form.type, description: form.description, amount: parseFloat(form.amount), tag: form.tag || 'General', method: form.method })
    }
    onClose()
  }

  const isIncome = form.type === 'income'
  const accent = isIncome ? '#10b981' : '#ef4444'
  const accentBg = isIncome ? '#e8faf3' : '#fef0f0'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,23,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '8px 0 40px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
              {isIncome ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1117' }}>Nuevo {isIncome ? 'Ingreso' : 'Egreso'}</div>
              <div style={{ fontSize: 12, color: '#a8b0bf', marginTop: 1 }}>Registra el movimiento</div>
            </div>
            {myRecurring.length > 0 && (
              <button onClick={() => setShowRecurring(s => !s)} style={{ background: accentBg, border: `1px solid ${accent}33`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: accent, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={12} /> Recurrentes
              </button>
            )}
          </div>

          {showRecurring && myRecurring.length > 0 && (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px', border: '1px solid #eef0f4', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...eyebrow, marginBottom: 4 }}>Seleccionar recurrente</div>
              {myRecurring.map(r => (
                <button key={r.id} onClick={() => applyRecurring(r)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #eef0f4', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f1117' }}>{r.description}</div>
                    <div style={{ fontSize: 11, color: '#a8b0bf' }}>{r.tag} · {r.method}</div>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: accent, fontWeight: 500 }}>{fmt(r.amount)}</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 18px', border: `2px solid ${accent}22` }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Monto (MXN)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: accent }}>$</span>
              <input autoFocus type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: accent, outline: 'none', width: '100%' }} />
            </div>
          </div>

          <input placeholder="Concepto" value={form.description} onChange={e => set('description', e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '10px 0', fontSize: 15, color: '#0f1117', outline: 'none', background: 'transparent' }} />

          <input placeholder="Nota o comentario (opcional)" value={form.nota} onChange={e => set('nota', e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '8px 0', fontSize: 14, color: '#68717f', outline: 'none', background: 'transparent' }} />

          <div>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Fecha</div>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              style={{ width: '100%', border: '1.5px solid #eef0f4', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#f8fafc', color: '#0f1117' }} />
          </div>

          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Método</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['tarjeta', 'efectivo'] as const).map(m => (
                <button key={m} onClick={() => set('method', m)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${form.method === m ? accent : '#eef0f4'}`, background: form.method === m ? accentBg : '#f8fafc', color: form.method === m ? accent : '#a8b0bf', fontWeight: 500, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {m === 'tarjeta' ? <><CreditCard size={15} /> Tarjeta</> : <><Banknote size={15} /> Efectivo</>}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: form.recurrente ? accentBg : '#f8fafc', borderRadius: 12, border: `1.5px solid ${form.recurrente ? accent : '#eef0f4'}` }}>
            <input type="checkbox" checked={form.recurrente} onChange={e => set('recurrente', e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117' }}>Guardar como recurrente</div>
              <div style={{ fontSize: 11, color: '#a8b0bf' }}>Lo podrás reutilizar rápidamente</div>
            </div>
          </label>

          <button onClick={submit} style={{ background: accent, border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 4 }}>
            Guardar {isIncome ? 'Ingreso' : 'Egreso'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Pendiente ───────────────────────────────────────────────────────────
function AddPendingModal({ defaultType, recurringCobros, recurringHacers, onAdd, onAddRecurringCobro, onAddRecurringHacer, onClose }: {
  defaultType: 'hacer' | 'cobrar'; recurringCobros: RecurringCobro[]; recurringHacers: RecurringHacer[]
  onAdd: (p: Pending) => void; onAddRecurringCobro: (r: RecurringCobro) => void; onAddRecurringHacer: (r: RecurringHacer) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ type: defaultType, description: '', amount: '', dueDate: new Date().toISOString().slice(0, 10), tag: '', nota: '', recordatorio: '', guardarRecurrente: false })
  const [showPicker, setShowPicker] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const isCobrar = form.type === 'cobrar'
  const currentRecurrentes = isCobrar ? recurringCobros : recurringHacers
  const accent = isCobrar ? '#f59e0b' : '#6366f1'
  const pickerBg = isCobrar ? '#fffbeb' : '#eef2ff'
  const pickerBorder = isCobrar ? '#fde68a' : '#c7d2fe'
  const pickerText = isCobrar ? '#92400e' : '#3730a3'

  const applyRecurrente = (r: RecurringCobro | RecurringHacer) => {
    setForm(f => ({ ...f, description: r.description, amount: String(r.amount), nota: r.nota }))
    setShowPicker(false)
  }
  const submit = () => {
    if (!form.description || !form.amount) return
    onAdd({ id: Date.now().toString(), type: form.type, description: form.description, amount: parseFloat(form.amount), dueDate: form.dueDate, tag: form.tag || 'General', nota: form.nota, recordatorio: form.recordatorio })
    if (form.guardarRecurrente) {
      const amt = parseFloat(form.amount)
      if (isCobrar && !recurringCobros.find(r => r.description === form.description)) {
        onAddRecurringCobro({ id: 'rc_' + Date.now(), description: form.description, amount: amt, nota: form.nota })
      } else if (!isCobrar && !recurringHacers.find(r => r.description === form.description)) {
        onAddRecurringHacer({ id: 'rh_' + Date.now(), description: form.description, amount: amt, nota: form.nota })
      }
    }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,23,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '8px 0 40px', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1117' }}>Pago por {isCobrar ? 'cobrar' : 'hacer'}</div>
            {currentRecurrentes.length > 0 && (
              <button onClick={() => setShowPicker(s => !s)} style={{ background: pickerBg, border: `1px solid ${pickerBorder}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: pickerText, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={12} /> Recurrentes
              </button>
            )}
          </div>

          {showPicker && currentRecurrentes.length > 0 && (
            <div style={{ background: pickerBg, borderRadius: 12, padding: '10px 12px', border: `1px solid ${pickerBorder}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...eyebrow, color: pickerText, marginBottom: 2 }}>Seleccionar recurrente</div>
              {currentRecurrentes.map(r => (
                <button key={r.id} onClick={() => applyRecurrente(r)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${pickerBorder}`, borderRadius: 9, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f1117' }}>{r.description}</div>
                    {r.nota ? <div style={{ fontSize: 11, color: '#a8b0bf' }}>{r.nota}</div> : null}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: accent, fontWeight: 500 }}>{fmt(r.amount)}</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 18px', border: `2px solid ${accent}22` }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Monto (MXN)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: accent }}>$</span>
              <input autoFocus type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: accent, outline: 'none' }} />
            </div>
          </div>

          <input placeholder="Descripción" value={form.description} onChange={e => set('description', e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '10px 0', fontSize: 15, color: '#0f1117', outline: 'none', background: 'transparent' }} />

          <input placeholder="Nota o comentario (opcional)" value={form.nota} onChange={e => set('nota', e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '8px 0', fontSize: 14, color: '#68717f', outline: 'none', background: 'transparent' }} />

          {form.type === 'hacer' && (
            <div>
              <div style={{ ...eyebrow, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Bell size={11} /> Recordatorio
              </div>
              <input type="date" value={form.recordatorio} onChange={e => set('recordatorio', e.target.value)}
                style={{ width: '100%', border: `1.5px solid ${form.recordatorio ? '#f59e0b' : '#eef0f4'}`, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: form.recordatorio ? '#fffbeb' : '#f8fafc', color: '#0f1117' }} />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: form.guardarRecurrente ? pickerBg : '#f8fafc', borderRadius: 12, border: `1.5px solid ${form.guardarRecurrente ? accent : '#eef0f4'}` }}>
            <input type="checkbox" checked={form.guardarRecurrente} onChange={e => set('guardarRecurrente', e.target.checked)} style={{ width: 16, height: 16, accentColor: accent }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117' }}>Guardar como recurrente</div>
              <div style={{ fontSize: 11, color: '#a8b0bf' }}>Lo podrás reutilizar la próxima vez</div>
            </div>
          </label>

          <button onClick={submit} style={{ background: accent, border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nueva categoría de ahorro ──────────────────────────────────────────
function AddCategoryModal({ onAdd, onClose }: { onAdd: (c: SavingCategory) => void; onClose: () => void }) {
  const EMOJIS = ['🛡️', '✈️', '🚗', '🏠', '📱', '🎓', '💍', '🏖️', '💻', '🎸', '🏋️', '🍼']
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [emoji, setEmoji] = useState('🛡️')
  const submit = () => {
    if (!name.trim()) return
    onAdd({ id: 'cat_' + Date.now(), name: name.trim(), goal: parseFloat(goal) || 0, emoji })
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,23,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '8px 0 40px', width: '100%', maxWidth: 480 }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1117' }}>Nueva categoría</div>
          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Ícono</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${emoji === e ? '#f59e0b' : '#eef0f4'}`, background: emoji === e ? '#fffbeb' : '#f8fafc', fontSize: 18, cursor: 'pointer' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <input autoFocus placeholder="Nombre (ej: Viaje a Europa)" value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '10px 0', fontSize: 15, color: '#0f1117', outline: 'none', background: 'transparent' }} />
          <div>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Meta (opcional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1.5px solid #eef0f4', paddingBottom: 8 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#a8b0bf' }}>$</span>
              <input type="number" placeholder="0" value={goal} onChange={e => setGoal(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#0f1117', outline: 'none' }} />
            </div>
          </div>
          <button onClick={submit} style={{ background: '#f59e0b', border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Crear categoría
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Ahorro ──────────────────────────────────────────────────────────────
function AddSavingModal({ categories, onAdd, onClose }: { categories: SavingCategory[]; onAdd: (s: Saving) => void; onClose: () => void }) {
  const [form, setForm] = useState({ categoryId: categories[0]?.id || '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'tarjeta' as 'tarjeta' | 'efectivo', nota: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const submit = () => {
    if (!form.categoryId || !form.amount) return
    onAdd({ id: Date.now().toString(), categoryId: form.categoryId, amount: parseFloat(form.amount), date: form.date, method: form.method, nota: form.nota })
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,23,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '8px 0 40px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1117' }}>Agregar ahorro</div>

          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Categoría</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => set('categoryId', c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${form.categoryId === c.id ? '#f59e0b' : '#eef0f4'}`, background: form.categoryId === c.id ? '#fffbeb' : '#f8fafc', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117' }}>{c.name}</div>
                    {c.goal > 0 && <div style={{ fontSize: 11, color: '#a8b0bf' }}>Meta: {fmt(c.goal)}</div>}
                  </div>
                  {form.categoryId === c.id && <Check size={16} color="#f59e0b" />}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#fffbeb', borderRadius: 14, padding: '14px 18px', border: '2px solid #fde68a' }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Monto (MXN)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: '#f59e0b' }}>$</span>
              <input autoFocus type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: '#f59e0b', outline: 'none' }} />
            </div>
          </div>

          <input placeholder="Nota (opcional)" value={form.nota} onChange={e => set('nota', e.target.value)}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #eef0f4', padding: '8px 0', fontSize: 14, color: '#68717f', outline: 'none', background: 'transparent' }} />

          <div style={{ display: 'flex', gap: 8 }}>
            {(['tarjeta', 'efectivo'] as const).map(m => (
              <button key={m} onClick={() => set('method', m)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${form.method === m ? '#f59e0b' : '#eef0f4'}`, background: form.method === m ? '#fffbeb' : '#f8fafc', color: form.method === m ? '#f59e0b' : '#a8b0bf', fontWeight: 500, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {m === 'tarjeta' ? <><CreditCard size={15} /> Tarjeta</> : <><Banknote size={15} /> Efectivo</>}
              </button>
            ))}
          </div>

          <button onClick={submit} style={{ background: '#f59e0b', border: 'none', borderRadius: 14, color: '#fff', padding: '14px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Guardar Ahorro
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rows ──────────────────────────────────────────────────────────────────────
function TxRow({ tx, onDelete }: { tx: Transaction; onDelete: (id: string) => void }) {
  const isIncome = tx.type === 'income'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f6f8' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: isIncome ? '#e8faf3' : '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
        {getEmoji(tx.tag)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#0f1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</span>
          {tx.recurrente && <span style={{ fontSize: 9, background: '#ede9fe', color: '#7c3aed', borderRadius: 4, padding: '1px 5px', fontWeight: 600, flexShrink: 0, letterSpacing: '0.04em' }}>RECURRENTE</span>}
          {tx.createdBy && <UserBadge name={tx.createdBy} />}
        </div>
        <div style={{ fontSize: 12, color: '#a8b0bf', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          {tx.tag}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>·{tx.method === 'tarjeta' ? <CreditCard size={10} /> : <Banknote size={10} />}</span>
          {tx.date}
          {tx.nota ? <span style={{ color: '#d1d5db' }}>· {tx.nota}</span> : null}
        </div>
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 500, color: isIncome ? '#10b981' : '#374151', flexShrink: 0 }}>
        {isIncome ? '+' : '-'}{fmt(tx.amount)}
      </div>
      <button onClick={() => onDelete(tx.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <X size={16} />
      </button>
    </div>
  )
}

function PendingRow({ p, onDelete, onMark }: { p: Pending; onDelete: (id: string) => void; onMark: (id: string) => void }) {
  const isHacer = p.type === 'hacer'
  const daysLeft = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000)
  const urgent = daysLeft <= 3
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid #f5f6f8' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: isHacer ? '#eef2ff' : '#fef9e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isHacer ? '#6366f1' : '#f59e0b', flexShrink: 0 }}>
        {isHacer ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#0f1117' }}>{p.description}</span>
          {p.createdBy && <UserBadge name={p.createdBy} />}
        </div>
        <div style={{ fontSize: 12, color: urgent ? '#ef4444' : '#a8b0bf', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {p.tag}
          {urgent && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#ef4444' }}><AlertCircle size={11} /> {daysLeft <= 0 ? 'Vencido' : `${daysLeft}d`}</span>}
          {!urgent && <span>· {p.dueDate}</span>}
          {p.recordatorio && <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Bell size={10} /> {p.recordatorio}</span>}
          {p.nota ? <span style={{ color: '#d1d5db' }}>· {p.nota}</span> : null}
        </div>
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 500, color: isHacer ? '#6366f1' : '#f59e0b', flexShrink: 0 }}>
        {isHacer ? '-' : '+'}{fmt(p.amount)}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={() => onMark(p.id)} title="Marcar pagado" style={{ background: '#f0fdf4', border: 'none', borderRadius: 8, color: '#10b981', cursor: 'pointer', padding: '7px 8px', display: 'flex', alignItems: 'center' }}>
          <Check size={14} />
        </button>
        <button onClick={() => onDelete(p.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function SavingRow({ s, onDelete }: { s: Saving; onDelete: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f6f8' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef9e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
        <PiggyBank size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#a8b0bf', display: 'flex', alignItems: 'center', gap: 4 }}>
          {s.method === 'tarjeta' ? <CreditCard size={10} /> : <Banknote size={10} />} {s.date}
          {s.nota ? <span style={{ color: '#d1d5db' }}>· {s.nota}</span> : null}
        </div>
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 500, color: '#f59e0b' }}>+{fmt(s.amount)}</div>
      <button onClick={() => onDelete(s.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
        <X size={16} />
      </button>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Session — stored in localStorage so it persists across reloads
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('finanza_userName'))
  const [accountId, setAccountId] = useState<string | null>(() => localStorage.getItem('finanza_accountId'))
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const lastSavedAt = useRef<number>(0)

  const [nav, setNav] = useState<NavTab>('inicio')
  const [txs, setTxs] = useState<Transaction[]>(INIT_TXS)
  const [pendings, setPendings] = useState<Pending[]>(INIT_PENDING)
  const [savingCats, setSavingCats] = useState<SavingCategory[]>(INIT_SAVING_CATS)
  const [savings, setSavings] = useState<Saving[]>(INIT_SAVINGS)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [recurring, setRecurring] = useState<Recurring[]>(INIT_RECURRING)
  const [recurringCobros, setRecurringCobros] = useState<RecurringCobro[]>(INIT_RECURRING_COBRO)
  const [recurringHacers, setRecurringHacers] = useState<RecurringHacer[]>(INIT_RECURRING_HACER)
  const [showAddRecCobro, setShowAddRecCobro] = useState(false)
  const [newRecCobro, setNewRecCobro] = useState({ description: '', amount: '', nota: '' })
  const [showAddRecHacer, setShowAddRecHacer] = useState(false)
  const [newRecHacer, setNewRecHacer] = useState({ description: '', amount: '', nota: '' })
  const [addModal, setAddModal] = useState<TxType | null>(null)
  const [addPendModal, setAddPendModal] = useState<'hacer' | 'cobrar' | null>(null)
  const [showAddSaving, setShowAddSaving] = useState(false)
  const [reportFilter, setReportFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [reportPeriod, setReportPeriod] = useState<'dia' | 'semana' | 'mes'>('mes')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pendCobraMonth, setPendCobraMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [pendHacerMonth, setPendHacerMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const prevMonthLabel = prevDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  const income      = useMemo(() => txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [txs])
  const expense     = useMemo(() => txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [txs])
  const prevIncome  = useMemo(() => txs.filter(t => t.type === 'income' && t.date.startsWith(prevMonth)).reduce((s, t) => s + t.amount, 0), [txs, prevMonth])
  const prevExpense = useMemo(() => txs.filter(t => t.type === 'expense' && t.date.startsWith(prevMonth)).reduce((s, t) => s + t.amount, 0), [txs, prevMonth])
  const prevBalance = prevIncome - prevExpense
  const balance     = income - expense
  const tarjetaBal  = useMemo(() => txs.filter(t => t.method === 'tarjeta').reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0), [txs])
  const efectivoBal = useMemo(() => txs.filter(t => t.method === 'efectivo').reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0), [txs])
  const savingTarjeta  = useMemo(() => savings.filter(s => s.method === 'tarjeta').reduce((a, s) => a + s.amount, 0), [savings])
  const savingEfectivo = useMemo(() => savings.filter(s => s.method === 'efectivo').reduce((a, s) => a + s.amount, 0), [savings])
  const savingTotal    = savingTarjeta + savingEfectivo
  const expByTag  = useMemo(() => { const m: Record<string, number> = {}; txs.filter(t => t.type === 'expense').forEach(t => { m[t.tag] = (m[t.tag] || 0) + t.amount }); return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) }, [txs])
  const incByTag  = useMemo(() => { const m: Record<string, number> = {}; txs.filter(t => t.type === 'income').forEach(t => { m[t.tag] = (m[t.tag] || 0) + t.amount }); return Object.entries(m).map(([name, value]) => ({ name, value })) }, [txs])
  const pendHacer  = pendings.filter(p => p.type === 'hacer')
  const pendCobrar = pendings.filter(p => p.type === 'cobrar')
  const totalHacer  = pendHacer.reduce((s, p) => s + p.amount, 0)
  const totalCobrar = pendCobrar.reduce((s, p) => s + p.amount, 0)

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  }
  const shiftMonth = (cur: string, dir: 1 | -1) => {
    const [y, m] = cur.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const pendHacerFiltered  = useMemo(() => pendHacer.filter(p => p.dueDate.startsWith(pendHacerMonth)), [pendHacer, pendHacerMonth])
  const pendCobraFiltered  = useMemo(() => pendCobrar.filter(p => p.dueDate.startsWith(pendCobraMonth)), [pendCobrar, pendCobraMonth])
  const totalHacerFiltered  = pendHacerFiltered.reduce((s, p) => s + p.amount, 0)
  const totalCobraFiltered  = pendCobraFiltered.reduce((s, p) => s + p.amount, 0)
  const periodLabel = useMemo(() => {
    const d = new Date(reportDate + 'T12:00:00')
    if (reportPeriod === 'dia') return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    if (reportPeriod === 'semana') {
      const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return `${mon.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  }, [reportDate, reportPeriod])

  const periodTxs = useMemo(() => {
    return txs.filter(t => {
      const td = new Date(t.date + 'T12:00:00')
      const rd = new Date(reportDate + 'T12:00:00')
      if (reportPeriod === 'dia') return t.date === reportDate
      if (reportPeriod === 'mes') return t.date.slice(0, 7) === reportDate.slice(0, 7)
      // semana: Mon–Sun of the week containing reportDate
      const mon = new Date(rd); mon.setDate(rd.getDate() - ((rd.getDay() + 6) % 7)); mon.setHours(0,0,0,0)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999)
      return td >= mon && td <= sun
    })
  }, [txs, reportDate, reportPeriod])

  const reportTxs = useMemo(() => reportFilter === 'all' ? periodTxs : periodTxs.filter(t => t.type === reportFilter), [periodTxs, reportFilter])

  const reportBarData = useMemo(() => {
    const m: Record<string, { tag: string; ingresos: number; egresos: number }> = {}
    periodTxs.forEach(t => {
      if (!m[t.tag]) m[t.tag] = { tag: t.tag, ingresos: 0, egresos: 0 }
      if (t.type === 'income') m[t.tag].ingresos += t.amount
      else m[t.tag].egresos += t.amount
    })
    return Object.values(m).slice(0, 6)
  }, [periodTxs])

  const periodIncome  = useMemo(() => periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [periodTxs])
  const periodExpense = useMemo(() => periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [periodTxs])
  const periodBalance = periodIncome - periodExpense

  const shiftDate = (dir: 1 | -1) => {
    const d = new Date(reportDate + 'T12:00:00')
    if (reportPeriod === 'dia') d.setDate(d.getDate() + dir)
    else if (reportPeriod === 'semana') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setReportDate(d.toISOString().slice(0, 10))
  }

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.setFont('helvetica')
    doc.setFontSize(18)
    doc.setTextColor(15, 17, 23)
    doc.text('Reporte Financiero', 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(120, 130, 150)
    doc.text(periodLabel, 14, 28)
    doc.setFontSize(10)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })}`, 14, 34)

    // Summary boxes
    doc.setFontSize(11)
    doc.setTextColor(15, 17, 23)
    const summaryY = 44
    ;[
      { label: 'Ingresos', val: fmt(periodIncome), color: [16, 185, 129] as [number,number,number] },
      { label: 'Egresos', val: fmt(periodExpense), color: [239, 68, 68] as [number,number,number] },
      { label: 'Balance', val: fmt(periodBalance), color: periodBalance >= 0 ? [16,185,129] as [number,number,number] : [239,68,68] as [number,number,number] },
    ].forEach((s, i) => {
      const x = 14 + i * 62
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, summaryY, 58, 18, 2, 2, 'F')
      doc.setFontSize(8); doc.setTextColor(160, 176, 191); doc.text(s.label, x + 4, summaryY + 6)
      doc.setFontSize(12); doc.setTextColor(...s.color); doc.text(s.val, x + 4, summaryY + 14)
    })

    // Transactions table
    autoTable(doc, {
      startY: summaryY + 26,
      head: [['Fecha', 'Descripción', 'Categoría', 'Método', 'Tipo', 'Monto']],
      body: reportTxs.map(t => [
        t.date,
        t.description,
        t.tag,
        t.method === 'tarjeta' ? 'Tarjeta' : 'Efectivo',
        t.type === 'income' ? 'Ingreso' : 'Egreso',
        (t.type === 'income' ? '+' : '-') + fmt(t.amount),
      ]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
    })

    doc.save(`reporte-${reportDate.slice(0, 7)}.pdf`)
  }

  // ── Sync ─────────────────────────────────────────────────────────────────
  const applySnapshot = useCallback((data: any) => {
    if (!data) return
    if (Array.isArray(data.txs)) setTxs(data.txs)
    if (Array.isArray(data.pendings)) setPendings(data.pendings)
    if (Array.isArray(data.savingCats)) setSavingCats(data.savingCats)
    if (Array.isArray(data.savings)) setSavings(data.savings)
    if (Array.isArray(data.recurring)) setRecurring(data.recurring)
    if (Array.isArray(data.recurringCobros)) setRecurringCobros(data.recurringCobros)
    if (Array.isArray(data.recurringHacers)) setRecurringHacers(data.recurringHacers)
  }, [])

  const pushToCloud = useCallback((snap: object) => {
    if (!accountId) return
    const ts = Date.now()
    lastSavedAt.current = ts
    setSyncStatus('syncing')
    saveAccount(accountId, { ...snap, updatedAt: ts, updatedBy: userName })
      .then(() => setSyncStatus('ok'))
      .catch(() => setSyncStatus('error'))
  }, [accountId, userName])

  // Load initial data on mount
  useEffect(() => {
    if (!accountId) return
    setSyncStatus('syncing')
    loadAccount(accountId).then(data => {
      if (data?.updatedAt) {
        applySnapshot(data)
        lastSavedAt.current = data.updatedAt
      } else {
        const snap = { txs: INIT_TXS, pendings: INIT_PENDING, savingCats: INIT_SAVING_CATS, savings: INIT_SAVINGS, recurring: INIT_RECURRING, recurringCobros: INIT_RECURRING_COBRO, recurringHacers: INIT_RECURRING_HACER }
        saveAccount(accountId, { ...snap, updatedAt: Date.now(), updatedBy: userName })
        lastSavedAt.current = Date.now()
      }
      setSyncStatus('ok')
    }).catch(() => setSyncStatus('error'))
  }, [accountId])

  // Poll every 5s for the other user's changes
  useEffect(() => {
    if (!accountId) return
    const iv = setInterval(() => {
      loadAccount(accountId).then(data => {
        if (data?.updatedAt && data.updatedAt > lastSavedAt.current) {
          applySnapshot(data)
          lastSavedAt.current = data.updatedAt
          setSyncStatus('ok')
        }
      }).catch(() => setSyncStatus('error'))
    }, 5000)
    return () => clearInterval(iv)
  }, [accountId, applySnapshot])

  const handleSetupDone = (uName: string, aId: string) => {
    localStorage.setItem('finanza_userName', uName)
    localStorage.setItem('finanza_accountId', aId)
    setUserName(uName)
    setAccountId(aId)
  }

  const handleLogout = () => {
    localStorage.removeItem('finanza_userName')
    localStorage.removeItem('finanza_accountId')
    setUserName(null)
    setAccountId(null)
  }

  // ── Mutation helpers (all hooks above this line) ──────────────────────────
  // Early return must come AFTER all hooks to satisfy React rules
  if (!userName || !accountId) {
    return <UserSetup onDone={handleSetupDone} />
  }

  const addTx = (t: Transaction) => {
    const item = { ...t, createdBy: userName }
    setTxs(p => { const n = [item, ...p]; pushToCloud({ txs: n, pendings, savingCats, savings, recurring, recurringCobros, recurringHacers }); return n })
  }
  const delTx = (id: string) => setTxs(p => { const n = p.filter(t => t.id !== id); pushToCloud({ txs: n, pendings, savingCats, savings, recurring, recurringCobros, recurringHacers }); return n })
  const addPend = (p: Pending) => {
    const item = { ...p, createdBy: userName }
    setPendings(prev => { const n = [item, ...prev]; pushToCloud({ txs, pendings: n, savingCats, savings, recurring, recurringCobros, recurringHacers }); return n })
  }
  const delPend = (id: string) => setPendings(p => { const n = p.filter(x => x.id !== id); pushToCloud({ txs, pendings: n, savingCats, savings, recurring, recurringCobros, recurringHacers }); return n })
  const markPend = (id: string) => setPendings(p => { const n = p.filter(x => x.id !== id); pushToCloud({ txs, pendings: n, savingCats, savings, recurring, recurringCobros, recurringHacers }); return n })
  const addSaving = (s: Saving) => {
    const item = { ...s, createdBy: userName }
    setSavings(p => { const n = [item, ...p]; pushToCloud({ txs, pendings, savingCats, savings: n, recurring, recurringCobros, recurringHacers }); return n })
  }
  const delSaving = (id: string) => setSavings(p => { const n = p.filter(s => s.id !== id); pushToCloud({ txs, pendings, savingCats, savings: n, recurring, recurringCobros, recurringHacers }); return n })
  const addSavingCat = (c: SavingCategory) => setSavingCats(p => { const n = [...p, c]; pushToCloud({ txs, pendings, savingCats: n, savings, recurring, recurringCobros, recurringHacers }); return n })
  const delSavingCat = (id: string) => {
    setSavingCats(p => { const n = p.filter(c => c.id !== id); setSavings(s => { const ns = s.filter(x => x.categoryId !== id); pushToCloud({ txs, pendings, savingCats: n, savings: ns, recurring, recurringCobros, recurringHacers }); return ns }); return n })
  }
  const addRecurring = (r: Recurring) => setRecurring(p => { const n = [...p, r]; pushToCloud({ txs, pendings, savingCats, savings, recurring: n, recurringCobros, recurringHacers }); return n })
  const delRecurring = (id: string) => setRecurring(p => { const n = p.filter(r => r.id !== id); pushToCloud({ txs, pendings, savingCats, savings, recurring: n, recurringCobros, recurringHacers }); return n })
  const addRecurringCobro = (r: RecurringCobro) => setRecurringCobros(p => { const n = [...p, r]; pushToCloud({ txs, pendings, savingCats, savings, recurring, recurringCobros: n, recurringHacers }); return n })
  const delRecurringCobro = (id: string) => setRecurringCobros(p => { const n = p.filter(r => r.id !== id); pushToCloud({ txs, pendings, savingCats, savings, recurring, recurringCobros: n, recurringHacers }); return n })
  const addRecurringHacer = (r: RecurringHacer) => setRecurringHacers(p => { const n = [...p, r]; pushToCloud({ txs, pendings, savingCats, savings, recurring, recurringCobros, recurringHacers: n }); return n })
  const delRecurringHacer = (id: string) => setRecurringHacers(p => { const n = p.filter(r => r.id !== id); pushToCloud({ txs, pendings, savingCats, savings, recurring, recurringCobros, recurringHacers: n }); return n })

  const NAV: { id: NavTab; label: string; icon: React.ReactNode; activeColor: string }[] = [
    { id: 'inicio', label: 'Inicio', icon: <Home size={18} />, activeColor: '#6366f1' },
    { id: 'pagos-cobrar', label: 'Por Cobrar', icon: <ArrowDownCircle size={18} />, activeColor: '#f59e0b' },
    { id: 'pagos-hacer', label: 'Por Pagar', icon: <ArrowUpCircle size={18} />, activeColor: '#6366f1' },
    { id: 'reporte', label: 'Reporte', icon: <BarChart2 size={18} />, activeColor: '#10b981' },
    { id: 'ahorro', label: 'Ahorro', icon: <PiggyBank size={18} />, activeColor: '#f59e0b' },
    { id: 'cuenta', label: 'Cuenta', icon: <User size={18} />, activeColor: '#6366f1' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {addModal && <AddModal defaultType={addModal} recurring={recurring} onAdd={addTx} onAddRecurring={addRecurring} onClose={() => setAddModal(null)} />}
      {addPendModal && <AddPendingModal defaultType={addPendModal} recurringCobros={recurringCobros} recurringHacers={recurringHacers} onAdd={addPend} onAddRecurringCobro={addRecurringCobro} onAddRecurringHacer={addRecurringHacer} onClose={() => setAddPendModal(null)} />}
      {showAddSaving && <AddSavingModal categories={savingCats} onAdd={addSaving} onClose={() => setShowAddSaving(false)} />}
      {showAddCategory && <AddCategoryModal onAdd={addSavingCat} onClose={() => setShowAddCategory(false)} />}

      <div style={{ width: '100%', maxWidth: 430, minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column', paddingBottom: 72 }}>

        {/* ── INICIO ── */}
        {nav === 'inicio' && (
          <div style={{ flex: 1 }}>
            <div style={{ padding: '52px 20px 20px', background: '#fff', ...sh }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ ...eyebrow }}>agosto 2026</div>
                  <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Mi Cartera</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {syncStatus === 'ok' && <Wifi size={14} color="#10b981" />}
                  {syncStatus === 'error' && <WifiOff size={14} color="#ef4444" />}
                  {syncStatus === 'syncing' && <RefreshCw size={14} color="#f59e0b" />}
                  <button onClick={() => setNav('cuenta')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <button onClick={() => setAddModal('income')} style={{ background: 'linear-gradient(135deg,#10b981,#34d399)', border: 'none', borderRadius: 16, padding: '18px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, ...sh }}>
                  <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.25)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <TrendingUp size={16} />
                  </div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Agregar Ingreso</div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Registrar entrada</div>
                </button>
                <button onClick={() => setAddModal('expense')} style={{ background: 'linear-gradient(135deg,#f43f5e,#fb7185)', border: 'none', borderRadius: 16, padding: '18px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, ...sh }}>
                  <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.25)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <TrendingDown size={16} />
                  </div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Agregar Egreso</div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Registrar salida</div>
                </button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 16, padding: '14px 16px', border: '1px solid #eef0f4' }}>
                <div style={{ ...eyebrow, marginBottom: 10 }}>Saldo disponible</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '11px 13px', border: '1px solid #eef0f4' }}>
                    <div style={{ fontSize: 11, color: '#a8b0bf', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Tarjeta</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 16, color: '#3b82f6' }}>{fmt(tarjetaBal)}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '11px 13px', border: '1px solid #eef0f4' }}>
                    <div style={{ fontSize: 11, color: '#a8b0bf', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={11} /> Efectivo</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 16, color: '#f59e0b' }}>{fmt(Math.abs(efectivoBal))}</div>
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: '10px 13px', border: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#68717f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 17, color: '#10b981' }}>{fmt(balance)}</div>
                </div>
              </div>
            </div>

            <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #eef0f4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>Balance del mes</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: balance >= 0 ? '#10b981' : '#ef4444', lineHeight: 1 }}>{fmt(balance)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <div><span style={{ color: '#10b981', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13 }}>+{fmt(income)}</span><span style={{ color: '#a8b0bf', marginLeft: 4, fontSize: 11 }}>ingresos</span></div>
                  <div><span style={{ color: '#f43f5e', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13 }}>-{fmt(expense)}</span><span style={{ color: '#a8b0bf', marginLeft: 4, fontSize: 11 }}>egresos</span></div>
                </div>
              </div>
            </div>

            <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #eef0f4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>Mes anterior · {prevMonthLabel}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: prevBalance >= 0 ? '#10b981' : '#ef4444', lineHeight: 1 }}>{prevIncome + prevExpense === 0 ? '—' : fmt(prevBalance)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <div><span style={{ color: '#10b981', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13 }}>+{fmt(prevIncome)}</span><span style={{ color: '#a8b0bf', marginLeft: 4, fontSize: 11 }}>ingresos</span></div>
                  <div><span style={{ color: '#f43f5e', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13 }}>-{fmt(prevExpense)}</span><span style={{ color: '#a8b0bf', marginLeft: 4, fontSize: 11 }}>egresos</span></div>
                </div>
              </div>
            </div>

            <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #eef0f4' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', marginBottom: 4 }}>Últimos movimientos</div>
              {txs.slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} onDelete={delTx} />)}
            </div>

            {/* Próximos vencimientos */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10)
              const nextHacer = [...pendHacer].filter(p => p.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 2)
              const nextCobrar = [...pendCobrar].filter(p => p.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 2)
              if (!nextHacer.length && !nextCobrar.length) return null
              return (
                <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #eef0f4' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', marginBottom: 12 }}>Próximos vencimientos</div>

                  {nextHacer.length > 0 && (
                    <>
                      <div style={{ ...eyebrow, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <ArrowUpCircle size={11} color="#6366f1" /> Por pagar
                      </div>
                      {nextHacer.map(p => {
                        const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000)
                        const urgent = days <= 3
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f5f6f8' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                              <ArrowUpCircle size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                              <div style={{ fontSize: 11, color: urgent ? '#ef4444' : '#a8b0bf', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                {urgent ? <><AlertCircle size={10} /> {days <= 0 ? 'Vencido' : `${days}d`}</> : p.dueDate}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: '#6366f1' }}>-{fmt(p.amount)}</div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {nextCobrar.length > 0 && (
                    <>
                      <div style={{ ...eyebrow, marginBottom: 8, marginTop: nextHacer.length ? 14 : 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <ArrowDownCircle size={11} color="#f59e0b" /> Por cobrar
                      </div>
                      {nextCobrar.map(p => {
                        const days = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86400000)
                        const urgent = days <= 3
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f5f6f8' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fef9e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                              <ArrowDownCircle size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                              <div style={{ fontSize: 11, color: urgent ? '#ef4444' : '#a8b0bf', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                {urgent ? <><AlertCircle size={10} /> {days <= 0 ? 'Vencido' : `${days}d`}</> : p.dueDate}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>+{fmt(p.amount)}</div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })()}

          </div>
        )}

        {/* ── PAGOS POR HACER ── */}
        {nav === 'pagos-hacer' && (
          <div style={{ flex: 1, padding: '52px 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <div style={{ ...eyebrow }}>Compromisos</div>
                <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Por Pagar</div>
              </div>
              <button onClick={() => setAddPendModal('hacer')} style={{ background: '#6366f1', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Agregar</button>
            </div>

            <MonthStrip selected={pendHacerMonth} onChange={setPendHacerMonth} accent="#6366f1" pendings={pendHacer} />

            <div style={{ background: '#fff', borderRadius: 18, padding: '15px 18px', marginBottom: 12, border: '1px solid #eef2ff', ...sh }}>
              <div style={{ ...eyebrow, marginBottom: 5 }}>Total del mes</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: '#6366f1' }}>-{fmt(totalHacerFiltered)}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 18, padding: '4px 18px', ...sh, border: '1px solid #eef0f4', marginBottom: 12 }}>
              {pendHacerFiltered.length === 0
                ? <div style={{ padding: '32px 0', textAlign: 'center', color: '#a8b0bf', fontSize: 14 }}>Sin pagos en este mes</div>
                : pendHacerFiltered.map(p => <PendingRow key={p.id} p={p} onDelete={delPend} onMark={markPend} />)}
            </div>

            <div style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #eef2ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} color="#6366f1" /> Pagos recurrentes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#a8b0bf' }}>{recurringHacers.length} guardados</span>
                  <button onClick={() => { setShowAddRecHacer(s => !s); setNewRecHacer({ description: '', amount: '', nota: '' }) }}
                    style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Agregar</button>
                </div>
              </div>

              {showAddRecHacer && (
                <div style={{ background: '#eef2ff', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="Descripción" value={newRecHacer.description} onChange={e => setNewRecHacer(p => ({ ...p, description: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #c7d2fe', background: 'transparent', padding: '6px 0', fontSize: 14, outline: 'none', width: '100%', color: '#0f1117' }} />
                  <input placeholder="Monto" type="number" value={newRecHacer.amount} onChange={e => setNewRecHacer(p => ({ ...p, amount: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #c7d2fe', background: 'transparent', padding: '6px 0', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'DM Mono, monospace', color: '#0f1117' }} />
                  <input placeholder="Nota (opcional)" value={newRecHacer.nota} onChange={e => setNewRecHacer(p => ({ ...p, nota: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #c7d2fe', background: 'transparent', padding: '6px 0', fontSize: 13, color: '#a8b0bf', outline: 'none', width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => {
                      if (!newRecHacer.description.trim() || !newRecHacer.amount) return
                      addRecurringHacer({ id: 'rh_' + Date.now(), description: newRecHacer.description, amount: parseFloat(newRecHacer.amount), nota: newRecHacer.nota })
                      setShowAddRecHacer(false)
                    }} style={{ flex: 1, background: '#6366f1', border: 'none', borderRadius: 9, color: '#fff', padding: '9px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Guardar</button>
                    <button onClick={() => setShowAddRecHacer(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 9, color: '#68717f', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {recurringHacers.length === 0 && !showAddRecHacer
                ? <div style={{ padding: '16px 0', textAlign: 'center', color: '#a8b0bf', fontSize: 13 }}>Presiona "+ Agregar" para crear un recurrente</div>
                : recurringHacers.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #f5f6f8' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                      <RefreshCw size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                      {r.nota ? <div style={{ fontSize: 12, color: '#a8b0bf', marginTop: 1 }}>{r.nota}</div> : null}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: '#6366f1', flexShrink: 0 }}>-{fmt(r.amount)}</div>
                    <button onClick={() => addPend({ id: Date.now().toString(), type: 'hacer', description: r.description, amount: r.amount, dueDate: new Date().toISOString().slice(0, 10), tag: 'General', nota: r.nota, recordatorio: '' })}
                      style={{ background: '#eef2ff', border: 'none', borderRadius: 8, color: '#6366f1', cursor: 'pointer', padding: '7px 8px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <Plus size={14} />
                    </button>
                    <button onClick={() => delRecurringHacer(r.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── PAGOS POR COBRAR ── */}
        {nav === 'pagos-cobrar' && (
          <div style={{ flex: 1, padding: '52px 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <div style={{ ...eyebrow }}>Esperados</div>
                <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Por Cobrar</div>
              </div>
              <button onClick={() => setAddPendModal('cobrar')} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Agregar</button>
            </div>

            <MonthStrip selected={pendCobraMonth} onChange={setPendCobraMonth} accent="#f59e0b" pendings={pendCobrar} />

            <div style={{ background: '#fff', borderRadius: 18, padding: '15px 18px', marginBottom: 12, border: '1px solid #fef3c7', ...sh }}>
              <div style={{ ...eyebrow, marginBottom: 5 }}>Total del mes</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 600, color: '#f59e0b' }}>+{fmt(totalCobraFiltered)}</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 18, padding: '4px 18px', ...sh, border: '1px solid #eef0f4', marginBottom: 12 }}>
              {pendCobraFiltered.length === 0
                ? <div style={{ padding: '32px 0', textAlign: 'center', color: '#a8b0bf', fontSize: 14 }}>Sin cobros en este mes</div>
                : pendCobraFiltered.map(p => <PendingRow key={p.id} p={p} onDelete={delPend} onMark={markPend} />)}
            </div>

            <div style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', ...sh, border: '1px solid #fef3c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} color="#f59e0b" /> Ingresos recurrentes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#a8b0bf' }}>{recurringCobros.length} guardados</span>
                  <button onClick={() => { setShowAddRecCobro(s => !s); setNewRecCobro({ description: '', amount: '', nota: '' }) }}
                    style={{ background: '#f59e0b', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Agregar</button>
                </div>
              </div>

              {showAddRecCobro && (
                <div style={{ background: '#fffbeb', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="Descripción" value={newRecCobro.description} onChange={e => setNewRecCobro(p => ({ ...p, description: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #fde68a', background: 'transparent', padding: '6px 0', fontSize: 14, outline: 'none', width: '100%', color: '#0f1117' }} />
                  <input placeholder="Monto" type="number" value={newRecCobro.amount} onChange={e => setNewRecCobro(p => ({ ...p, amount: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #fde68a', background: 'transparent', padding: '6px 0', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'DM Mono, monospace', color: '#0f1117' }} />
                  <input placeholder="Nota (opcional)" value={newRecCobro.nota} onChange={e => setNewRecCobro(p => ({ ...p, nota: e.target.value }))}
                    style={{ border: 'none', borderBottom: '1.5px solid #fde68a', background: 'transparent', padding: '6px 0', fontSize: 13, color: '#a8b0bf', outline: 'none', width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => {
                      if (!newRecCobro.description.trim() || !newRecCobro.amount) return
                      addRecurringCobro({ id: 'rc_' + Date.now(), description: newRecCobro.description, amount: parseFloat(newRecCobro.amount), nota: newRecCobro.nota })
                      setShowAddRecCobro(false)
                    }} style={{ flex: 1, background: '#f59e0b', border: 'none', borderRadius: 9, color: '#fff', padding: '9px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Guardar</button>
                    <button onClick={() => setShowAddRecCobro(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 9, color: '#68717f', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {recurringCobros.length === 0 && !showAddRecCobro
                ? <div style={{ padding: '16px 0', textAlign: 'center', color: '#a8b0bf', fontSize: 13 }}>Presiona "+ Agregar" para crear un recurrente</div>
                : recurringCobros.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #f5f6f8' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef9e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                      <RefreshCw size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0f1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                      {r.nota ? <div style={{ fontSize: 12, color: '#a8b0bf', marginTop: 1 }}>{r.nota}</div> : null}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: '#f59e0b', flexShrink: 0 }}>+{fmt(r.amount)}</div>
                    <button onClick={() => addPend({ id: Date.now().toString(), type: 'cobrar', description: r.description, amount: r.amount, dueDate: new Date().toISOString().slice(0, 10), tag: 'General', nota: r.nota, recordatorio: '' })}
                      style={{ background: '#fef9e7', border: 'none', borderRadius: 8, color: '#f59e0b', cursor: 'pointer', padding: '7px 8px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <Plus size={14} />
                    </button>
                    <button onClick={() => delRecurringCobro(r.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── REPORTE ── */}
        {nav === 'reporte' && (
          <div style={{ flex: 1, padding: '52px 12px 12px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <div style={{ ...eyebrow }}>Análisis</div>
                <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Reporte</div>
              </div>
              <button onClick={exportPDF}
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
                <FileDown size={15} /> PDF
              </button>
            </div>

            {/* Period type tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, background: '#fff', borderRadius: 12, padding: 4, border: '1px solid #eef0f4' }}>
              {([['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setReportPeriod(val)}
                  style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: reportPeriod === val ? '#f0f2f5' : 'transparent', color: reportPeriod === val ? '#0f1117' : '#a8b0bf' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Period navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #eef0f4', ...sh }}>
              <button onClick={() => shiftDate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} /></button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#0f1117', textTransform: 'capitalize' }}>{periodLabel}</div>
              <button onClick={() => shiftDate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} /></button>
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: '#fff', borderRadius: 12, padding: 4, border: '1px solid #eef0f4' }}>
              {([['all', 'Todo'], ['income', 'Ingresos'], ['expense', 'Egresos']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setReportFilter(val)}
                  style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: reportFilter === val ? '#f0f2f5' : 'transparent', color: reportFilter === val ? '#0f1117' : '#a8b0bf' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Ingresos', val: fmt(periodIncome), color: '#10b981' },
                { label: 'Egresos', val: fmt(periodExpense), color: '#ef4444' },
                { label: 'Balance', val: fmt(periodBalance), color: periodBalance >= 0 ? '#10b981' : '#ef4444' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', ...sh, border: '1px solid #eef0f4' }}>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            {reportBarData.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 18, padding: '16px 14px', marginBottom: 12, ...sh, border: '1px solid #eef0f4' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', marginBottom: 14 }}>Por categoría</div>
                <ResponsiveContainer width="100%" height={160} minWidth={0}>
                  <BarChart data={reportBarData} barCategoryGap="40%" margin={{ top: 0, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="tag" tick={{ fill: '#a8b0bf', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#a8b0bf', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<PieTip />} />
                    <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos" />
                    <Bar dataKey="egresos" fill="#6366f1" radius={[4, 4, 0, 0]} name="Egresos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Transaction list */}
            <div style={{ background: '#fff', borderRadius: 18, padding: '4px 18px', ...sh, border: '1px solid #eef0f4' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1117', padding: '13px 0 2px' }}>
                {reportTxs.length} transacciones
              </div>
              {reportTxs.length === 0
                ? <div style={{ padding: '24px 0', textAlign: 'center', color: '#a8b0bf', fontSize: 14 }}>Sin movimientos en este período</div>
                : reportTxs.map(tx => <TxRow key={tx.id} tx={tx} onDelete={delTx} />)}
            </div>
          </div>
        )}

        {/* ── AHORRO ── */}
        {nav === 'ahorro' && (
          <div style={{ flex: 1, padding: '52px 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <div style={{ ...eyebrow }}>Independiente</div>
                <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Ahorro</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddCategory(true)} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', letterSpacing: '0.01em' }}>+ Categoría</button>
                <button onClick={() => savingCats.length > 0 && setShowAddSaving(true)} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: savingCats.length === 0 ? 0.5 : 1 }}>+ Agregar</button>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', borderRadius: 20, padding: '20px', marginBottom: 12, color: '#fff', ...sh }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>Total ahorrado</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 32, fontWeight: 600 }}>{fmt(savingTotal)}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}><CreditCard size={10} /> Tarjeta</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 500 }}>{fmt(savingTarjeta)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}><Banknote size={10} /> Efectivo</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 500 }}>{fmt(savingEfectivo)}</div>
                </div>
              </div>
            </div>

            {savingCats.length === 0
              ? <div style={{ background: '#fff', borderRadius: 18, padding: '32px 18px', textAlign: 'center', color: '#a8b0bf', fontSize: 14, ...sh }}>
                  Crea una categoría para empezar a ahorrar
                </div>
              : savingCats.map(cat => {
                  const catTotal = savings.filter(s => s.categoryId === cat.id).reduce((a, s) => a + s.amount, 0)
                  const pct = cat.goal > 0 ? Math.min((catTotal / cat.goal) * 100, 100) : 0
                  const catSavings = savings.filter(s => s.categoryId === cat.id)
                  return (
                    <div key={cat.id} style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', marginBottom: 12, ...sh, border: '1px solid #eef0f4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cat.emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#0f1117' }}>{cat.name}</div>
                          {cat.goal > 0 && <div style={{ fontSize: 12, color: '#a8b0bf', marginTop: 1 }}>Meta: {fmt(cat.goal)}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 600, color: '#f59e0b' }}>{fmt(catTotal)}</div>
                          {cat.goal > 0 && <div style={{ fontSize: 11, color: '#a8b0bf' }}>{pct.toFixed(0)}%</div>}
                        </div>
                        <button onClick={() => delSavingCat(cat.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                          <X size={16} />
                        </button>
                      </div>

                      {cat.goal > 0 && (
                        <div style={{ height: 6, background: '#f5f6f8', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#f59e0b', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      )}

                      {catSavings.length > 0 && (
                        <div style={{ borderTop: '1px solid #f5f6f8', paddingTop: 8 }}>
                          {catSavings.map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                              <div style={{ fontSize: 12, color: '#a8b0bf', flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {s.method === 'tarjeta' ? <CreditCard size={10} /> : <Banknote size={10} />} {s.date}{s.nota ? ` · ${s.nota}` : ''}
                              </div>
                              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>+{fmt(s.amount)}</div>
                              <button onClick={() => delSaving(s.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* ── CUENTA ── */}
        {nav === 'cuenta' && (
          <div style={{ flex: 1, padding: '52px 12px 12px' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...eyebrow }}>Mi</div>
              <div style={{ fontWeight: 700, fontSize: 24, color: '#0f1117', marginTop: 3 }}>Cuenta</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', borderRadius: 20, padding: '24px', marginBottom: 14, color: '#fff', ...sh }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{userName}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>agosto 2026</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Ingresos', val: fmt(income), Icon: TrendingUp },
                  { label: 'Egresos', val: fmt(expense), Icon: TrendingDown },
                  { label: 'Balance', val: fmt(balance), Icon: BarChart2 },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px' }}>
                    <s.Icon size={16} style={{ marginBottom: 4, opacity: 0.9 }} />
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account code */}
            <div style={{ background: '#fff', borderRadius: 18, ...sh, border: '1px solid #eef0f4', padding: '16px 18px', marginBottom: 14 }}>
              <div style={{ ...eyebrow, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Users size={11} /> Cuenta compartida</div>
              <div style={{ fontSize: 13, color: '#68717f', marginBottom: 10 }}>Comparte este código con alguien más para sincronizar:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #eef0f4' }}>
                <span style={{ flex: 1, fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 600, color: '#6366f1', letterSpacing: '0.12em' }}>{accountId}</span>
                <button
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(accountId).catch(() => {})
                    }
                  }}
                  style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                  <Copy size={13} /> Copiar
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: syncStatus === 'ok' ? '#10b981' : syncStatus === 'error' ? '#ef4444' : '#a8b0bf', display: 'flex', alignItems: 'center', gap: 5 }}>
                {syncStatus === 'ok' && <><Wifi size={12} /> Sincronizado</>}
                {syncStatus === 'error' && <><WifiOff size={12} /> Error de conexión</>}
                {(syncStatus === 'syncing' || syncStatus === 'idle') && <><RefreshCw size={12} /> Conectando...</>}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 18, ...sh, border: '1px solid #eef0f4', overflow: 'hidden', marginBottom: 14 }}>
              {[
                { label: 'Transacciones', value: txs.length + '', Icon: RefreshCw, color: '#6366f1' },
                { label: 'Por pagar', value: pendHacer.length + '', Icon: ArrowUpCircle, color: '#6366f1' },
                { label: 'Por cobrar', value: pendCobrar.length + '', Icon: ArrowDownCircle, color: '#f59e0b' },
                { label: 'Recurrentes', value: recurring.length + '', Icon: RefreshCw, color: '#10b981' },
                { label: 'Ahorro total', value: fmt(savingTotal), Icon: PiggyBank, mono: true, color: '#f59e0b' },
                { label: 'Flujo esperado', value: fmt(balance + totalCobrar - totalHacer), Icon: BarChart2, mono: true, color: balance + totalCobrar - totalHacer >= 0 ? '#10b981' : '#ef4444' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid #f5f6f8' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.color }}>
                    <row.Icon size={17} />
                  </div>
                  <div style={{ flex: 1, fontSize: 14, color: '#374151', fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontFamily: (row as any).mono ? 'DM Mono, monospace' : 'Outfit, sans-serif', fontWeight: 600, fontSize: 14, color: row.color }}>{row.value}</div>
                </div>
              ))}
            </div>

            <button onClick={handleLogout}
              style={{ width: '100%', background: '#fff', border: '1.5px solid #fee2e2', borderRadius: 14, color: '#ef4444', padding: '13px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        )}

        {/* ── Bottom nav ── */}
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#fff', borderTop: '1px solid #eef0f4', display: 'flex', zIndex: 100 }}>
          {NAV.map(item => {
            const active = nav === item.id
            return (
              <button key={item.id} onClick={() => setNav(item.id)}
                style={{ flex: 1, border: 'none', background: 'none', padding: '10px 2px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: active ? item.activeColor : '#b8bfc9' }}>
                {item.icon}
                <div style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? item.activeColor : '#a8b0bf', whiteSpace: 'nowrap' }}>{item.label}</div>
                {active && <div style={{ width: 16, height: 2, background: item.activeColor, borderRadius: 2 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
