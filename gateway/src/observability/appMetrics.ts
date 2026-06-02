export type MetricLabels = Record<string, string | number | undefined>;

interface CounterMetric {
  value: number;
  labels: Record<string, string>;
}
interface GaugeMetric {
  value: number;
  labels: Record<string, string>;
}

function labelKey(labels: MetricLabels = {}): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${String(labels[key] ?? "")}`)
    .join(",");
}

function normalizeLabels(labels: MetricLabels = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels).map(([key, value]) => [key, String(value ?? "")])
  );
}

export class AppMetrics {
  private readonly counters = new Map<string, CounterMetric>();
  private readonly gauges = new Map<string, GaugeMetric>();

  increment(name: string, labels: MetricLabels = {}, amount = 1): void {
    const key = `${name}:${labelKey(labels)}`;
    const metric = this.counters.get(key) ?? {
      value: 0,
      labels: normalizeLabels(labels)
    };
    metric.value += amount;
    this.counters.set(key, metric);
  }

  setGauge(name: string, labels: MetricLabels = {}, value: number): void {
    const key = `${name}:${labelKey(labels)}`;
    this.gauges.set(key, {
      value,
      labels: normalizeLabels(labels)
    });
  }

  renderCounters(): string {
    const counters = Array.from(this.counters.entries())
      .map(([key, metric]) => {
        const [name] = key.split(":");
        const labels = renderLabels(metric.labels);
        return `${name}${labels} ${metric.value}`;
      });
    const gauges = Array.from(this.gauges.entries()).map(([key, metric]) => {
      const [name] = key.split(":");
      const labels = renderLabels(metric.labels);
      return `${name}${labels} ${metric.value}`;
    });
    return [...counters, ...gauges].join("\n");
  }
}

function renderLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).filter(([, value]) => value.length > 0);
  if (entries.length === 0) return "";
  return `{${entries
    .map(([key, value]) => `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")}}`;
}

export const appMetrics = new AppMetrics();
