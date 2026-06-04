---
name: ml-llm-secops
description: Use when securing ML and LLM/agentic components — threat modeling AI systems, defending against prompt injection and jailbreaks (OWASP LLM Top 10), model & data supply-chain integrity, data poisoning, adversarial robustness, PII protection, and AI red-teaming (MITRE ATLAS). Trigger on "prompt injection", "secure the model/agent", "OWASP LLM", "data poisoning", "AI threat model", "red team", "MLSecOps", "LLMSecOps".
---

# ML/LLM SecOps (MLSecOps + LLMSecOps)

Security applied specifically to the AI parts of AquaMonitoring: `module_ai` (ML) and the
agentic-AI layer (LLM). Pairs with `devsecops-pipeline` (which covers the surrounding
app/infra) and `mlops-lifecycle` / `llmops-agentic` (which it hardens).

References: `background_context/security.md` (trust boundaries TB-1…TB-7 incl. **TB-7 AI
tooling → data/actions**, threat register T-13…T-16) and `background_context/agentic_ai.md`
(**AssessorFlow LLMSecOps golden pipeline**: Promptfoo OWASP tests, DeepEval quality,
DeepTeam adversarial, guardrail regression, RAG adversarial — the proven template).

## Threat-model first
Use **MITRE ATLAS** (adversarial ML tactics) + **OWASP ML Top 10** + **OWASP LLM Top 10**
to enumerate threats per AI component. Produce a threat model doc (STRIDE-style) listing
asset → threat → mitigation → evidence. AquaShield-specific seeds: poisoned SOP doc overrides
safety thresholds (T-13); LLM leaks another farm's data (T-14); unsafe treatment recommendation
(T-15); huge-prompt cost/latency DoS (T-16). This document alone is strong assessment material.

## LLMSecOps — OWASP LLM Top 10 (defend each)
| Risk | Defense in our system |
|------|----------------------|
| LLM01 Prompt injection | Input filtering, instruction/data separation, the validator agent, output schema validation, never let model output auto-execute privileged actions |
| LLM02 Insecure output handling | Treat LLM output as untrusted: validate/escape before use in SQL/HTML/shell/tool calls |
| LLM03 Training-data poisoning | Provenance + integrity checks on any fine-tune/RAG corpus |
| LLM04 Model DoS | Token/rate/cost limits, timeouts, input-size caps |
| LLM05 Supply chain | Pin & verify model + lib provenance; scan; SBOM for models |
| LLM06 Sensitive info disclosure | PII redaction in/out, no secrets in prompts, output filtering |
| LLM07 Insecure plugin/tool design | Tool allowlist, per-tool authz, least privilege, sandbox |
| LLM08 Excessive agency | Human-in-the-loop for high-impact actions, scoped tools |
| LLM09 Overreliance | Confidence signals, citations, validator gate, disclaimers |
| LLM10 Model theft | Access control on model endpoints, rate-limit, watermarking |

## MLSecOps — classical ML threats
- **Data poisoning:** validate/clean training data; anomaly-detect outliers; track lineage.
- **Evasion / adversarial inputs:** robustness testing; input sanitization on sensor data
  (a spoofed sensor stream is an attack vector here).
- **Model inversion / membership inference:** limit output detail; consider DP if PII.
- **Model integrity/supply chain:** sign model artifacts (`cosign`), verify on load, store
  in a registry with access control, scan serialized models (avoid pickle RCE — prefer
  `safetensors`/ONNX).
- **Tampering at serving:** mTLS, authz on inference endpoints, audit logging of predictions.

## Guardrails as code
- Input guardrails: injection/PII/jailbreak detectors (e.g. Llama Guard, presidio, regex+ML).
- Output guardrails: schema validation, policy checks, validator agent.
- Enforce in the request path, not just in tests; log blocks for review.

## AI red-teaming (evidence-rich, marks-worthy)
- Run an adversarial suite against agents/models (prompt-injection corpora, jailbreaks,
  poisoning probes). Tools: `garak`, `promptfoo` red-team, PyRIT.
- Record findings + fixes in `docs/evidence/ai-redteam.md`.

## Pipeline integration
- Add AI-specific gates to CI: scan model artifacts, run guardrail tests, run a red-team
  smoke suite, fail on regressions. Extends `devsecops-pipeline`.

## Output of this skill
An AI threat model (ATLAS/OWASP-mapped), guardrail implementations, signed/verified model
artifacts, a red-team report, and `docs/mlsecops-llmsecops.md` mapped to the rubric.
