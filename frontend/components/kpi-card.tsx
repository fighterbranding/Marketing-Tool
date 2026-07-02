interface KpiCardProps {
  label: string;
  value: string;
  change: number;
  accentColor: string;
}

export function KpiCard({ label, value, change, accentColor }: KpiCardProps) {
  const isPositive = change >= 0;
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {isPositive ? '+' : ''}
        {change.toFixed(1)}% vs prev period
      </p>
    </div>
  );
}
