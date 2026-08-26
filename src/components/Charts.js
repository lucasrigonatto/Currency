import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { brl } from '../lib/format';

const PALETTE = ['#1b4d3e', '#2f6f5e', '#c4a35a', '#8b5e3c', '#3d5a80', '#ee6c4d', '#293241', '#98c1d9', '#6b705c', '#a4161a', '#b08968', '#40916c'];

const tooltipStyle = {
  background: '#10231c',
  border: '1px solid rgba(196,163,90,0.35)',
  borderRadius: 8,
  color: '#f4f0e6',
};

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
      {label != null && <div style={{ marginBottom: 4, opacity: 0.8 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name}>{p.name}: <strong>{brl(p.value)}</strong></div>
      ))}
    </div>
  );
}

export function CategoryPie({ data }) {
  const chartData = data.map((d) => ({ name: d.name, value: d.amount }));
  if (!chartData.length) return <p className="muted">Sem dados para o gráfico.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={96} paddingAngle={2}>
          {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<MoneyTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, nameKey = 'name', valueKey = 'amount' }) {
  const chartData = data.slice(0, 8);
  if (!chartData.length) return <p className="muted">Sem dados para o gráfico.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis type="number" tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <YAxis type="category" dataKey={nameKey} width={110} stroke="#cfc6b4" tick={{ fontSize: 12 }} />
        <Tooltip content={<MoneyTooltip />} />
        <Bar dataKey={valueKey} name="Total" fill="#c4a35a" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
