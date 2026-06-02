# Grafana Setup

Start the observability profile:

```bash
docker compose --profile observability up -d prometheus grafana
```

Open Grafana at `http://localhost:3000`. The default local credentials are `admin` / `admin` unless `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` are set.

The Prometheus datasource is provisioned automatically from `docker/grafana/provisioning/datasources/prometheus.yml`. The dashboard export is provisioned from `docker/grafana/dashboards/grafana-dashboard.json`.

Dashboard coverage:

- API traffic and error rate
- Authentication failures, password reset, and email verification events
- Audit log activity
- Worker throughput
- Queue and DLQ depth
- Database query activity
- S3 upload activity

Screenshots should be captured from the running Grafana UI after loading representative traffic because this repository does not include live runtime credentials or browser automation artifacts.
