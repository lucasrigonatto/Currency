import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { brl, pct } from '../utils/format';

const PALETTE = [
  '#1b4d3e',
  '#2f6f5e',
  '#c4a35a',
  '#8b5e3c',
  '#3d5a80',
  '#ee6c4d',
  '#293241',
  '#98c1d9',
  '#e0fbfc',
  '#6b705c',
  '#a4161a',
  '#b08968',
  '#40916c',
];

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
        <div key={p.name}>
          {p.name}: <strong>{brl(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function CategoryPie({ data }) {
  const chartData = data.map((d) => ({ name: d.category, value: d.total }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={110} paddingAngle={2}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<MoneyTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MerchantBars({ data }) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.merchant.length > 18 ? `${d.merchant.slice(0, 16)}…` : d.merchant,
    total: d.total,
  }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis type="number" tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <YAxis type="category" dataKey="name" width={120} stroke="#cfc6b4" tick={{ fontSize: 12 }} />
        <Tooltip content={<MoneyTooltip />} />
        <Bar dataKey="total" name="Total" fill="#c4a35a" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }) {
  const chartData = data.map((d) => ({ name: d.category, total: d.total }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={chartData} margin={{ bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} stroke="#cfc6b4" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <Tooltip content={<MoneyTooltip />} />
        <Bar dataKey="total" name="Total" fill="#2f6f5e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyLine({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis dataKey="date" hide />
        <YAxis tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <Tooltip content={<MoneyTooltip />} />
        <Line type="monotone" dataKey="daily" name="Gasto do dia" stroke="#ee6c4d" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CumulativeLine({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis dataKey="date" hide />
        <YAxis tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <Tooltip content={<MoneyTooltip />} />
        <Line type="monotone" dataKey="cumulative" name="Acumulado" stroke="#c4a35a" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryCountBars({ data }) {
  const chartData = data.map((d) => ({ name: d.category, count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} stroke="#cfc6b4" tick={{ fontSize: 11 }} />
        <YAxis stroke="#cfc6b4" allowDecimals={false} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
                {label}: <strong>{payload[0].value}</strong> compras
              </div>
            ) : null
          }
        />
        <Bar dataKey="count" name="Compras" fill="#3d5a80" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBars({ data }) {
  const chartData = data.map((d) => ({
    name: d.day.replace('-feira', ''),
    total: d.total,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,240,230,0.12)" />
        <XAxis dataKey="name" stroke="#cfc6b4" />
        <YAxis tickFormatter={(v) => `R$${Math.round(v)}`} stroke="#cfc6b4" />
        <Tooltip content={<MoneyTooltip />} />
        <Bar dataKey="total" name="Total" fill="#8b5e3c" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RecurringPie({ recurring, eventual }) {
  const chartData = [
    { name: 'Recorrentes', value: recurring },
    { name: 'Ocasionais', value: eventual },
  ];
  const colors = ['#1b4d3e', '#c4a35a'];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
                {payload[0].name}: <strong>{brl(payload[0].value)}</strong> ({pct((payload[0].value / (recurring + eventual)) * 100)})
              </div>
            ) : null
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
