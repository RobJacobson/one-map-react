# Thin facade testing policy

This policy governs the replacement implementation described in [requirements](requirements.md) and the [stage plan](stage-plan.md). The previous testing plan was retired with the old implementation. Test the facade's forwarding, conversions, added lifecycle behavior, packaging, and advertised compatibility. Upstream libraries own their general regression suites.

## Complete acceptance units

This section is the authority for browser and native acceptance preparation, approval, execution, diagnosis and resumption. It supersedes earlier feature-by-feature approvals, cross-backend platform batches and standalone runtime probes as the default workflow. Focused unit/component/command regressions remain routine offline work; they need no acceptance approval.

One acceptance unit binds an immutable candidate, platform, backend, selected device/OS or browser target and resolved SDK/dependency identities. Account for every requirement of the retained contract using valid prior evidence plus every remaining scenario in one declared batch. The scope is the retained one-map-react contract, not general upstream SDK certification. Keep failures visible; do not weaken the contract or its assertions to obtain a pass.

Prepare and finish one platform/backend unit at a time, including future browser acceptance. Parallel acceptance requires an explicit owner exception with isolated resources. Web is currently complete; the remaining order is Android Mapbox, Android MapLibre, iOS Mapbox, then iOS MapLibre. Complete or explicitly block the selected unit before changing backend. A blocker requires its affected requirements, evidence, remaining uncertainty and owner options; it is neither a pass nor permission to skip to another backend. An owner may explicitly redirect work after that report.

### Prepare the complete batch

Before requesting execution approval, the implementation worker completes the packet and the coordinator independently audits:

1. A fixed coverage map accounts for all retained requirements, accepted evidence being reused, remaining rows and owner-approved exclusions. Previously passed camera, minimal, lifetime, query/source or rendering work is reused when its artifact and behavior remain applicable. A tooling change alone does not invalidate those results.
2. Implementation, connected caller/lifecycle review and applicable routine checks are complete. Exercise actual command and report paths with device-free regressions, including startup, errors, ownership, cancellation and teardown. Consolidate all known related fixes into one audited repair PR and one complete-unit resume proposal.
3. A self-contained packet supplies exact runnable commands, candidate/dependency/installed identity checks, one selected device/browser target and backend, setup and input route, owned resources, first-failure behavior and cleanup. Verify the entire call chain before dispatch; workers must not reconstruct commands from historical recipes.
4. Storage and elapsed-time budgets cover the complete batch. Use measured setup/build/cache peak storage plus explicit headroom and cleanup reserve; a bare minimum space check is insufficient. Preserve foreign resources and reuse verified applications, setup and owned resources where safe.

The current handoff contains only the selected unit, matrix/status, concrete next action and outcome links. Dispatch only the selected batch packet, not accumulated history. Preparation ends when that complete packet passes independent audit; it grants no application or calibration execution permission.

### Approval and execution

One owner approval covers the complete declared unit: immutable inputs, required setup, all remaining scenarios, any bounded existing calibration shown useful for that unit, expected duration, cleanup and explicit retry scope. Request this approval once preparation is concrete. Do not split the unit into one-feature approvals or feature-by-feature PR/run cycles. Application launch and calibration wait for approval; an implementation or process-rewrite instruction does not grant it.

One exclusive native worker, selected by the owner as GPT-6.1 Terra at medium reasoning for the current batches, owns that unit's Metro, device, native directories, installation, input and logs. The coordinator keeps artifact verification, diagnosis, repair review and acceptance decisions. Keep native work sequential; never switch backend to test the next feature. Reuse setup within the declared ownership boundaries. Report meaningful progress and decisions rather than repeated unchanged polls.

The worker stops at the first unexpected failure and reports the original outcome with owned cleanup. It makes no code changes or independent retry. Retain completed applicable results and resume remaining work only within explicit owner retry authorization. Fixing several related paths offline requires no acceptance approval; consolidate their review and propose one remaining-unit resume after audit. Changed artifacts need an impact review and approval for their declared scope, not an automatic repetition of accepted rows.

### Bounded blocker diagnosis

Start with saved evidence. For each blocker, allow at most 30 minutes of diagnosis before reassessing with the owner; separately authorized builds are excluded from that timebox. State a supported hypothesis, the smallest discriminating outcome and its time/resource budget before proposing an experiment. If the evidence supports neither a correction nor a useful experiment, report the unit blocked with concrete options.

A standalone runtime diagnostic requires an explicit owner exception naming its exact question, budget and decisive outcome. It earns no acceptance credit. Keep instrumentation specific to that question; do not build a speculative tracing framework. If the same operational failure recurs after an audited repair, or a failed diagnostic supplies no discriminator, stop the escalation loop and reassess the blocked unit. Further guards, diagnostic PRs and tiny reruns are not the default response.

A unit is complete only when every retained requirement has passed, has valid reused evidence, or has an explicit owner-approved exclusion. Blocked and unverified work remains open. Keep one compact current handoff, the coverage map and immutable outcome/provenance summaries; the [retention rules](#storage-and-tooling) govern temporary evidence.

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

Acceptance can take more than an hour. Agents must obtain explicit user permission before real-renderer browser suites, mixed Metro renderer transport, native acceptance builds/installations, or runtime flows. Complete implementation, review, and applicable routine checks first. Obtain approval for the complete platform/backend unit under [the batch protocol](#complete-acceptance-units), including immutable inputs, commands, duration, resources, cleanup and retry scope.

Routine formatting, documentation, type, unit, mocked component, library build, and package/selection checks may run during development. Inspect aggregate commands before running them so they do not launch acceptance indirectly. Lack of permission leaves the relevant runtime check unverified; it does not justify running it in the background.

The stage plan's acceptance criteria do not authorize execution. Once a relevant approved run passes, repeat it only for a subsequent change that can affect the result, an unresolved failure, or the final release gate.

## Smoke workers and models

Prefer subagents for approved smoke-test execution. A stronger coordinator prepares the harness, freezes and verifies the artifact, assigns resources, reviews failures, and decides the final acceptance outcome. Use GPT-6 Luna (`gpt-6-luna`) with low reasoning for fixed web smoke commands. Native units use the owner-selected exclusive worker under [the batch protocol](#approval-and-execution), currently GPT-6.1 Terra at medium reasoning. Record any owner-approved substitution and its reason before dispatch.

Run acceptance units serially by default. Parallel execution requires an explicit owner exception; then isolate server/debugger ports, browser profiles, temporary output directories and Vite caches. Give one worker exclusive ownership of shared Metro ports, simulators, native build directories, app installations, and device logs; keep that worker's native runs sequential. Synchronize example package copies from the verified artifact before starting any worker, and leave them unchanged while tests run.

Workers execute their assigned scope, preserve first-attempt results, and report unexpected failures to the coordinator. They do not change production code, refresh dependencies, or retry independently. The coordinator diagnoses failures and records any approved retry without replacing the original result. Subagents follow the same acceptance permission and retention rules as the coordinator.

## Evidence and artifact identity

Record the revision or artifact, selected versions, environments, scenario scope, result, and whether execution used mocks, real automation, or a manual procedure. Native acceptance must establish that the intended build is installed. Preserve the distinction between code review, declaration checking, and runtime verification.

A changed package hash identifies a different artifact; it does not itself require rerunning every scenario. Keep the original result attached to the artifact actually tested. For an unaffected change, record an impact review and the decision not to rerun the scenario without claiming that the new artifact was executed. A final release candidate gets the required release checks.

Track implementation completion separately from tests run for the current change. Use passed, failed, deliberately skipped with a reason, or unverified. Do not erase failures with a successful retry. Report the cause or unresolved flakiness and any resulting limitation on acceptance.

## Storage and tooling

Retain compact outcome/provenance summaries. Keep raw logs and screenshots only for an active investigation or a specific result that needs them. Remove generated consumers, build caches, old binaries, and redundant downloads when a checkpoint ends. Avoid multi-gigabyte evidence directories as a permanent requirement.

Reuse ordinary TypeScript, formatting, unit/component, browser, and native test tools. Keep native backend consumer apps separate where selected linking requires it. Reuse fixtures and scenario intent without building a general cross-platform test framework. Add test tooling only when the implemented feature needs it.

The current `validate` command runs routine checks only. Add feature tests as the corresponding implementation arrives; a command name or old passing count does not make a check required for the replacement.
