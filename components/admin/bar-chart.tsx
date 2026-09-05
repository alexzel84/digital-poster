export interface BarChartPoint {
  label: string;
  value: number;
}

export function BarChart({ title, data }: { title: string; data: BarChartPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 flex h-32 items-end gap-0.5">
        {data.map((point, i) => (
          <div
            key={i}
            className="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
            title={`${point.label}: ${point.value}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
