# AquaShield Shared API Contracts

This directory contains implementation-facing contracts shared across services.

| Path | Purpose |
|---|---|
| `proto/` | Internal gRPC contracts for service-to-service calls |
| `events/` | Google Pub/Sub JSON event schemas |

Public REST/OpenAPI contracts should be extracted from the current Django monolith and frontend call sites before implementation changes the API surface.
