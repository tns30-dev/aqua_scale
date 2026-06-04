# Phase 3 - Data Quality And Parameter Refinement

## Goal

Make the comparison feature credible with real parameter behavior, not just technically connected data.

Phase 1 proves backend integration. Phase 3 decides which parameters should be shown, how missing values behave, and what data must exist for a meaningful BioBloc demo.

## Parameter Source Of Truth

Current tension:

- Frontend has hardcoded display labels and "lower is better" rules in `utils/abTesting.ts`.
- Backend has `parameter_types`, `sensor_types.parameter_ids`, and `project_parameter_settings`.
- The actual `ParameterType` Django model currently expects `name`, but the local database has `parameter_name` and `parameter_code`.

Recommended direction:

1. Backend owns parameter metadata for API responses.
2. Frontend owns only rendering.
3. Backend sends:
   - `parameter`
   - `label`
   - `unit`
   - `lowerIsBetter`
   - `variant`
4. Frontend should not need a local parameter lookup except as a fallback.

## Missing Data Rules

Recommended behavior:

- If a parameter has values for both ponds, show full metric and chart.
- If a parameter has values for one pond only, show chart with the available side and mark the other as no data.
- If a parameter has no values for both ponds, omit it from default result.
- Optionally include omitted parameters in a `missingParameters` array for diagnostics.

Example:

```json
{
  "missingParameters": [
    { "parameter": "ammonium", "reason": "no_values_for_selected_range" },
    { "parameter": "turbidity", "reason": "no_values_for_selected_range" }
  ]
}
```

## Demo Data Gap

The current UI is BioBloc-flavored:

- Ammonium
- Dissolved O2
- Turbidity
- Electricity

The current local readings are AquaMonitoring-flavored:

- Temperature
- pH
- Salinity
- Dissolved Oxygen

That means the UI can be wired in phase 2, but the business story will still be weak until data is added or the displayed metrics are adjusted.

Recommended short-term options:

1. For engineering smoke tests, show only available parameters.
2. For BioBloc demo, add credible seeded readings for ammonium and turbidity.
3. Keep electricity out until there is a real table/source or a clearly marked manual record source.

## Treatment Metadata

The current `ponds.metadata` does not contain `treatment_start_date` in local data.

Options:

| Option | Pros | Cons |
|---|---|---|
| Put `treatment_start_date` in `ponds.metadata` | Fast, no schema migration | Weak domain model |
| Add a comparison/treatment config table | More explicit | More design work |
| Wait for `module_pond`/treatment model | Cleanest long term | Blocks UI realism |

Recommendation:

- Phase 1/2: allow `treatmentStartDate` to be null.
- Phase 3: decide if a temporary metadata key is acceptable for demo.
- Phase 5: move this to a first-class model if BioBloc treatment tracking becomes larger than comparison.

## Local Database Findings To Keep In Mind

- `project_sensors` currently exists only for Pond A and Pond B.
- `sensor_types.parameter_ids` points to temperature, salinity, pH, dissolved oxygen.
- `sensor_readings` has 185 rows total.
- `ammonium`, `turbidity`, and `ammonia` are currently empty in sampled readings.
- `ParameterType` ORM likely needs alignment with database columns before relying on it deeply.

## Acceptance Criteria

- Product-facing parameters are explicit and documented.
- Missing-data behavior is predictable.
- Backend response includes enough metadata for frontend display.
- The team decides whether to seed BioBloc demo data or adjust visible parameters for phase 1.
- Known model/schema mismatches are either fixed or avoided intentionally.
