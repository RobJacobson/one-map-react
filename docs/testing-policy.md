# Thin facade testing policy

This policy governs the replacement implementation described in [requirements](requirements.md) and the [stage plan](stage-plan.md). The previous testing plan was retired with the old implementation. Test the facade's forwarding, conversions, added lifecycle behavior, packaging, and advertised compatibility. Upstream libraries own their general regression suites.

## Select checks by the change

| Change | Routine checks | Runtime acceptance when needed |
| --- | --- | --- |
| Documentation, comments, or declaration ordering | Formatting, links, relevant examples/types; build if declaration output changes | None solely because the package hash changed. |
| Unchanged prop or method forwarding | Types and a focused assertion of the selected target, arguments, return value, and error propagation | Representative integration when a new forwarding path is introduced; not one runtime case per field. |
| Value, event, style, or coordinate conversion | Focused input/output tests, including meaningful invalid inputs and resets | Affected renderer scenarios where actual timing, units, or drawing matter. |
| Local adapter lifecycle or reuse | Component tests for callbacks, refs, cleanup, failures, and stale work | Relevant environments for that adapter; native changes cover both native OS targets when applicable. |
| Shared lifecycle or common behavior | Relevant unit/component suites and types | All affected backends; use all six environments when shared behavior can affect them. |
| Exports, peer dependencies, build, or Metro integration | Isolated packed-consumer, declaration, and selection checks | Actual transport or native linking checks when those mechanisms change. |
| Native bridge or SDK dependency changes | Affected static/component/package checks | Relevant native builds and scenarios against the selected SDKs. |
| Release or support-range expansion | Complete routine and packed-package checks | Approved six-environment conformance and applicable extension/device/service cases for the declared baselines. |

When choosing a smaller scope, record the changed behavior, selected checks, and why the other environments are unaffected. A brief PR or checkpoint note is sufficient. Do not build a custom impact-analysis system to implement this policy.

## Test behavior at the owning boundary

Use table-driven tests for straightforward mappings. Check observable values, upstream calls, errors, omission/reset behavior, and nonmutation when it is part of the contract. Avoid asserting helper structure, alphabetical getter order, incidental object identity, or which invalid field fails first unless a supported behavior depends on it.

Retain regressions for demonstrated failures. When simplifying implementation, rewrite a test that protects a real user behavior but currently asserts an internal sequence. Do not remove cleanup, credential redaction, late callback, or failed-query checks merely because they exercise error paths.

An unchanged host prop needs evidence of correct typing and forwarding. It does not need independent certification of React Native or browser behavior for each inherited field. A conversion or custom host reconciliation needs additional tests for the behavior it changes.

Use real renderers for representative integration and for claims that mocks cannot establish. Observe a known feature, actual camera state, physical interaction, or renderer output rather than accepting the requested value as proof. Test-only inspection is useful when independent readback is unavailable, but keep it out of the production API unless deliberately supported.

Prefer local styles and fixtures. Use bounded observation of load, rendering, or movement rather than fixed sleeps. Keep service-backed tests separate so ordinary translation tests do not depend on tile services or credentials. Do not compare identical pixels or event counts across renderers unless the common contract requires that result.

## Acceptance timing and user permission

Acceptance can take more than an hour. Agents must obtain explicit user permission before real-renderer browser suites, mixed Metro renderer transport, native acceptance builds/installations, or runtime flows. Complete implementation, review, and applicable routine checks first. Before requesting permission, identify the completed checkpoint, artifact or revision, environments, commands, and expected duration. Scope retries to that authorization.

Routine formatting, documentation, type, unit, mocked component, library build, and package/selection checks may run during development. Inspect aggregate commands before running them so they do not launch acceptance indirectly. Lack of permission leaves the relevant runtime check unverified; it does not justify running it in the background.

The stage plan's acceptance criteria do not authorize execution. Once a relevant approved run passes, repeat it only for a subsequent change that can affect the result, an unresolved failure, or the final release gate.

## Smoke workers and models

Prefer subagents for approved smoke-test execution. A stronger coordinator prepares the harness, freezes and verifies the artifact, assigns resources, reviews failures, and decides the final acceptance outcome. Use GPT-6 Luna (`gpt-6-luna`) with low reasoning for fixed web smoke commands and medium reasoning for a worker that manages native builds, devices, and processes. If that model is unavailable, record the replacement model and reason before dispatch.

Run independent workers in parallel when their resources are isolated. Assign separate server and debugger ports, browser profiles, temporary output directories, and Vite caches. Give one worker exclusive ownership of shared Metro ports, simulators, native build directories, app installations, and device logs; keep that worker's native runs sequential. Synchronize example package copies from the verified artifact before starting any worker, and leave them unchanged while tests run.

Workers execute their assigned scope, preserve first-attempt results, and report unexpected failures to the coordinator. They do not change production code, refresh dependencies, or retry independently. The coordinator diagnoses failures and records any approved retry without replacing the original result. Subagents follow the same acceptance permission and retention rules as the coordinator.

## Evidence and artifact identity

Record the revision or artifact, selected versions, environments, scenario scope, result, and whether execution used mocks, real automation, or a manual procedure. Native acceptance must establish that the intended build is installed. Preserve the distinction between code review, declaration checking, and runtime verification.

A changed package hash identifies a different artifact; it does not itself require rerunning every scenario. Keep the original result attached to the artifact actually tested. For an unaffected change, record an impact review and the decision not to rerun the scenario without claiming that the new artifact was executed. A final release candidate gets the required release checks.

Track implementation completion separately from tests run for the current change. Use passed, failed, deliberately skipped with a reason, or unverified. Do not erase failures with a successful retry. Report the cause or unresolved flakiness and any resulting limitation on acceptance.

## Storage and tooling

Retain compact outcome/provenance summaries. Keep raw logs and screenshots only for an active investigation or a specific result that needs them. Remove generated consumers, build caches, old binaries, and redundant downloads when a checkpoint ends. Avoid multi-gigabyte evidence directories as a permanent requirement.

Reuse ordinary TypeScript, formatting, unit/component, browser, and native test tools. Keep native backend consumer apps separate where selected linking requires it. Reuse fixtures and scenario intent without building a general cross-platform test framework. Add test tooling only when the implemented feature needs it.

The current `validate` command runs routine checks only. Add feature tests as the corresponding implementation arrives; a command name or old passing count does not make a check required for the replacement.
