---
name: mlops-lifecycle
description: Use when building the ML lifecycle for module_ai (the anomaly/forecast models on sensor data) — data/feature pipelines, experiment tracking, model registry, serving/inference service, CI/CD for models, and production monitoring (drift, performance). Trigger on "train a model", "model registry", "MLflow", "feature pipeline", "model serving", "drift detection", "MLOps".
---

# MLOps lifecycle (module_ai → ml-inference service)

`module_ai` (currently an empty placeholder) will operate on sensor telemetry for anomaly
detection / forecasting. Turn it into a reproducible, monitored, automated lifecycle.

Reference: `background_context/agentic_ai.md` — **AssessorFlow's** MLOps lane (EfficientNet-B0
on Vertex AI: dataset versioning, experiment tracking, quality-gate thresholds, registry,
staging/prod endpoints, canary, daily drift, GradCAM explainability) is the proven template.
**AquaShield first slice:** a forecast/anomaly model over well-populated params (temperature,
pH, salinity, dissolved oxygen), dataset versioned from `sensor_readings`. Keep it small +
evidenced (dataset desc, pipeline, metrics, registry, endpoint, drift job, screenshots).

## The loop
```
data ─▶ features ─▶ train/experiment ─▶ evaluate ─▶ register ─▶ deploy/serve ─▶ monitor ─┐
  ▲                                                                                        │
  └──────────────────────── retrain trigger (drift / schedule / new data) ◀───────────────┘
```

## Components & tooling (pick to match scope)
| Concern | Tool options |
|---------|--------------|
| Experiment tracking | **MLflow** (recommended), Weights & Biases |
| Data/feature versioning | DVC, LakeFS, Feast (feature store) |
| Pipeline orchestration | Kubeflow Pipelines, Airflow, Dagster, Prefect |
| Model registry | MLflow Registry (stage: Staging→Production) |
| Serving | **BentoML**, KServe, Seldon, FastAPI + ONNX Runtime |
| Monitoring | Evidently (drift), Prometheus + Grafana, whylogs |

## Reproducibility (non-negotiable for marks)
- Version **data + code + config + model** together. Every model artifact traces to a git
  SHA, a dataset hash, and an experiment run ID.
- Deterministic training (seeds), pinned environments, containerized training jobs.

## Serving the model as a service
- Wrap the model in **`ml-inference`** (its own microservice; see `microservices-decomposition`).
- Sync endpoint for on-demand scoring; async consumer on the event bus for streaming sensor
  data (score every reading / window).
- Expose `/predict`, `/health`, `/metrics`; log inputs+outputs (for monitoring & audit).
- Canary / shadow deploys for new model versions (mesh traffic shifting).

## Monitoring in production (closes the loop)
- **Data drift** (input distribution shifts — common as seasons/farms change).
- **Concept drift / performance decay** (need labels or proxy metrics).
- **Operational:** latency, throughput, error rate, resource use.
- Alert + **automated retrain trigger** when drift crosses a threshold → re-run pipeline →
  evaluate → if better, promote in registry → redeploy via GitOps.

## CI/CD for models (CT = continuous training)
- Pipeline: validate data → train → evaluate against a **gate** (must beat current prod on
  held-out metric) → register → deploy. Never auto-promote a worse model.
- Treat model deployment with the same DevSecOps gates (scan deps, sign artifacts).

## Security hook
Model supply-chain integrity, data poisoning, and adversarial robustness live in the
`ml-llm-secops` skill — apply it to every model you ship.

## Output of this skill
A reproducible training pipeline, an MLflow tracking+registry setup, the `ml-inference`
service, drift monitoring dashboards, and `docs/mlops.md` describing the lifecycle.
