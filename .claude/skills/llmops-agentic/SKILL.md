---
name: llmops-agentic
description: Use when building or operationalizing the agentic-AI layer — LLM/agent orchestration, prompt versioning & management, RAG pipelines, evaluation harnesses, guardrails, and LLM observability (tracing, cost, latency, token usage). Trigger on "agent", "LLM", "prompt management", "RAG", "eval", "LangGraph", "guardrails", "LLMOps".
---

# LLMOps & agentic AI

Reference: `background_context/agentic_ai.md` (distilled from **AssessorFlow**, your prior
agentic project: hub-and-spoke orchestrator + 6 gate agents, **Model Broker**, RAG, Langfuse
tracing, decision audit, golden pipeline). The "validator agent" you reported is one gate of
that system. Productionize agents the way we productionize models: versioned, evaluated,
observable, guarded.

**AquaShield MVP agentic slice** (defensible, tied to a real workflow — don't build all
agents): Sensor **Data-Quality Agent** → **Alert-Explanation Agent** (RAG over pond context +
SOP thresholds) → **Guardrail/Evaluator** → **human review gate** → audit log + trace. Use the
AssessorFlow hub-and-spoke shape: one Orchestrator owns state; spokes never call spokes.

## Agentic architecture
- Treat the agent layer as a service (or a few): orchestrator + tool-using agents.
- **Orchestration:** LangGraph / a state-machine of agents over an ad-hoc loop — explicit,
  debuggable, resumable. Define agents, tools, and the control graph as data.
- **Tools = governed capabilities.** Each tool call is an authz boundary (least privilege).
- For AquaMonitoring: agents could reason over sensor anomalies, summarize pond health,
  recommend actions, and **validate** outputs (validator agent) before they reach users.

## Prompt management (the "Ops" in LLMOps)
- **Version prompts in git** (or a prompt registry); never inline-and-forget. Each prompt
  has an ID, version, owner, and changelog.
- Separate prompt from code; parameterize; A/B test prompt versions with evals.

## Evaluation (most marks-worthy LLMOps practice)
- Build an **eval set** (golden inputs + expected behaviors/rubrics).
- Offline evals in CI: regression-test prompts/models on every change (LLM-as-judge +
  deterministic checks). Gate deploys on eval scores, like model CI.
- Online evals: sample prod traffic, score for quality/safety, feed failures back.
- Tools: `promptfoo`, `Ragas` (for RAG), `DeepEval`, custom harness.

## RAG (if used for knowledge grounding)
- Pipeline: ingest → chunk → embed → vector store → retrieve → rerank → generate.
- Evaluate retrieval (recall/precision) and generation (faithfulness, answer relevancy)
  separately. Track index versions.

## Guardrails (input + output)
- Input: prompt-injection detection, PII/secret redaction, schema/intent validation.
- Output: schema/structured-output validation, toxicity/policy checks, hallucination
  checks, **the validator agent** as a final gate.
- Hard limits: max tokens, tool-call allowlist, rate limits, cost ceilings.
- Deep security treatment → `ml-llm-secops` (OWASP LLM Top 10).

## Observability & cost
- Trace every agent run: spans for each LLM call + tool call (OpenTelemetry GenAI
  conventions). Tools: **Langfuse**, LangSmith, Phoenix.
- Track tokens, latency, cost per request and per agent; dashboard + budget alerts.
- Log prompts/responses (redacted) for debugging, evals, and audit.

## Deploy & lifecycle
- Version the whole agent config (model, prompts, tools, graph) as one release.
- Canary new versions; roll back on eval/guardrail regressions.
- Same DevSecOps gates on the agent service.

## Output of this skill
An orchestrated agent service, a prompt registry, an eval harness wired into CI, guardrails,
Langfuse-style tracing, and `docs/llmops.md` describing the agentic system + eval results.
