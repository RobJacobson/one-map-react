# Testing

Test this library's forwarding, conversions, lifecycle, packaging, and advertised compatibility. Upstream libraries own their general regression suites. The [library boundary](architecture.md) is the contract these checks protect.

## Current acceptance status

Acceptance stays deferred until the owner prepares a release or explicitly requests acceptance work. Continue ordinary development with the routine checks that match the change. Deferred renderer verification is a release gate. It does not block unrelated development. Keep one compact checkpoint. The [historical checkpoint](../records/evidence/acceptance-checkpoint.md) records earlier browser and Android outcomes for its own artifact. It does not certify this checkout.

## Complete acceptance units

This section is the authority for preparing, approving, running, diagnosing, and resuming browser and native acceptance. Focused unit, component, and command regressions are routine offline work. They need no acceptance approval.

One acceptance unit binds an immutable candidate, one platform, one backend, one device or browser target, and the resolved SDK and dependency identities. Account for every retained requirement with valid prior evidence plus every remaining scenario in one declared batch. The scope is the retained one-map-react contract. Keep failures visible. Leave the contract and its assertions unchanged when a run fails.

Prepare and finish one platform and backend unit at a time, including a future browser unit. Parallel acceptance requires an explicit owner exception with isolated resources. At resumption, declare the unit order from the changed behavior and the remaining release verification. Complete or explicitly block the selected unit before changing backend. A blocker names the affected requirements, the evidence, the remaining uncertainty, and the owner options. It is neither a pass nor permission to move to another backend. The owner can redirect work after that report.

### Prepare the complete batch

Before requesting execution approval, the implementation worker completes the packet and the coordinator audits it independently.

1. A fixed coverage map accounts for every retained requirement, the accepted evidence being reused, the remaining rows, and the owner-approved exclusions. Reuse a previous camera, startup, lifetime, query, source, or rendering pass when its artifact and behavior still apply. A tooling change alone does not invalidate those results.
2. Implementation, connected caller and lifecycle review, and the applicable routine checks are complete. Exercise the real command and report paths with device-free regressions, including startup, errors, ownership, cancellation, and teardown. Put the related fixes in one audited repair and one complete-unit resume proposal.
3. The packet supplies exact runnable commands, candidate and dependency identity checks, one selected device or browser and one backend, the setup and input route, the owned resources, first-failure behavior, and cleanup. Verify the whole call chain before dispatch. Workers use that packet. They do not reconstruct commands from old recipes.
4. Storage and elapsed-time budgets cover the complete batch, including measured setup, build, and cache peaks plus headroom and a cleanup reserve. Preserve foreign resources. Reuse a verified application, setup, and owned resources when that reuse is safe.

Dispatch only the selected batch packet. Preparation ends when that packet passes independent audit. Preparation grants no permission to launch the application or run calibration.

### Approval and execution

One owner approval covers the declared unit: immutable inputs, required setup, every remaining scenario, any bounded calibration shown useful for that unit, expected duration, cleanup, and the retry scope. Request this approval once the packet is concrete. Application launch and calibration wait for that approval. An implementation instruction does not grant it.

One exclusive native worker, selected by the owner for that unit, owns its Metro session, device, native directories, installation, input, and logs. The coordinator keeps artifact verification, diagnosis, repair review, and the acceptance decision. Keep native work on one backend until the unit is complete or blocked. Reuse setup inside the declared ownership boundaries.

The worker stops at the first unexpected failure, reports the original outcome, and cleans up what it owns. It leaves production code unchanged and does not retry. Keep completed applicable results. Resume the remaining work only inside an explicit owner retry. Fixing related paths offline needs no acceptance approval. After that audit, propose one resume for the remaining unit. A changed artifact needs an impact review and approval for its declared scope.

### Bounded blocker diagnosis

Start from saved evidence. For each blocker, spend at most 30 minutes on diagnosis before returning to the owner. A separately authorized build is outside that limit. State a supported hypothesis, the smallest discriminating outcome, and its time and resource budget before proposing an experiment. When the evidence supports neither a correction nor a useful experiment, report the unit blocked and give concrete options.

A standalone runtime diagnostic needs an explicit owner exception that names the question, the budget, and the decisive outcome. It earns no acceptance credit. Keep its instrumentation specific to that question. When the same operational failure returns after an audited repair, or a failed diagnostic supplies no discriminator, stop and reassess the blocked unit with the owner.

A unit is complete only when every retained requirement has passed, has valid reused evidence, or has an explicit owner-approved exclusion. Blocked and unverified work stays open. Keep one compact checkpoint with artifact identity, exercised scope, outcomes, and remaining gates. The [retention rules](#storage-and-tooling) govern temporary evidence.

## Select checks by the change

| Change | Routine checks | Runtime acceptance when needed |
| --- | --- | --- |
| Documentation, comments, or declaration ordering | Formatting, links, relevant examples and types. Build when declaration output changes. | None solely because the package hash changed. |
| Unchanged prop or method forwarding | Types and a focused assertion of the selected target, arguments, return value, and error propagation. | Representative integration when a new forwarding path is introduced. |
| Value, event, style, or coordinate conversion | Focused input and output tests, including meaningful invalid inputs and resets. | Affected renderer scenarios where timing, units, or drawing matter. |
| Local adapter lifecycle or reuse | Component tests for callbacks, refs, cleanup, failures, and stale work. | The environments for that adapter. A native change covers both native OS targets when it can affect them. |
| Shared lifecycle or common behavior | The relevant unit and component suites, and types. | Every affected backend. Use all six environments when the shared behavior can affect them. |
| Exports, peer dependencies, build, or Metro integration | Isolated packed-consumer, declaration, and selection checks. | Transport or native linking checks when those mechanisms change. |
| Native bridge or SDK dependency changes | The affected static, component, and package checks. | The relevant native builds and scenarios against the selected SDKs. |
| Release or support-range expansion | The complete routine and packed-package checks. | Approved six-environment conformance and the applicable extension, device, and service cases for the declared baselines. |

When the scope is smaller than the table, record the changed behavior, the selected checks, and why the other environments are unaffected. A short PR or checkpoint note is enough.

## Test behavior at the owning boundary

Use table-driven tests for straightforward mappings. Check observable values, upstream calls, errors, omission and reset behavior, and nonmutation when the contract requires it. Assert helper structure, getter order, incidental object identity, or which invalid field fails first only when a supported behavior depends on that detail.

Keep regressions for demonstrated failures. When simplifying implementation, rewrite a test that protects a user-visible behavior and currently asserts an internal sequence. Keep cleanup, credential redaction, late-callback, and failed-query checks when those paths are part of the contract.

An unchanged host prop needs evidence of correct typing and forwarding. A conversion or custom host reconciliation needs tests for the behavior it changes.

Use a real renderer for representative integration and for a claim a mock cannot establish. Observe a known feature, actual camera state, physical interaction, or renderer output. Prefer local styles and fixtures. Bound the observation of load, rendering, or movement. Keep service-backed tests separate so ordinary translation tests do not depend on tile services or credentials. Compare pixels or event counts across renderers only when the common contract requires that result.

## Acceptance timing and user permission

Acceptance can take more than an hour. Obtain explicit user permission before a real-renderer browser suite, mixed Metro renderer transport, a native acceptance build or installation, or a runtime flow. Finish implementation, review, and the applicable routine checks first. Obtain approval for the complete platform and backend unit under [the batch protocol](#complete-acceptance-units), including immutable inputs, commands, duration, resources, cleanup, and retry scope.

Routine formatting, documentation, type, unit, mocked component, library build, and package or selection checks may run during development. Inspect an aggregate command before running it so it does not launch acceptance. Without permission, report the runtime check as unverified and continue the authorized routine work.

Acceptance criteria written in a document do not authorize execution. After an approved run passes, repeat it for a later change that can affect the result, for an unresolved failure, or for the final release gate.

## Workers

The coordinator prepares the harness, freezes and verifies the artifact, assigns resources, reviews failures, and decides the acceptance outcome. The owner selects one exclusive worker for the native unit. That worker owns the unit's Metro session, device, native directories, installation, input, and logs.

Run acceptance units serially. Parallel execution requires an explicit owner exception, with isolated server ports, browser profiles, temporary output directories, and Vite caches. One worker owns shared Metro ports, simulators, native build directories, app installations, and device logs, and runs its native backends one after another. Copy the example package from the verified artifact before any worker starts, and leave those copies unchanged while tests run.

Workers run their assigned scope, preserve the first attempt, and report an unexpected failure to the coordinator. They leave production code unchanged, and they do not refresh dependencies or retry. The coordinator diagnoses the failure and records any approved retry beside the original result. Subagents follow the same permission and retention rules as the coordinator.

## Evidence and artifact identity

Record the revision or artifact, the selected versions, the environments, the scenario scope, the result, and whether execution used mocks, real automation, or a manual procedure. Native acceptance must show that the intended build is installed. Keep code review, declaration checking, and runtime verification distinct.

A changed package hash identifies a different artifact. It does not by itself require every scenario to run again. Keep results attached to the artifact that was tested. For an unaffected change, a short note naming the selected checks is enough. A final release candidate gets the required release checks.

Track implementation completion separately from the tests run for the current change. Use passed, failed, deliberately skipped with a reason, or unverified. Keep the original failure when a later retry passes. Report the cause, or the unresolved flakiness, and any limit that places on acceptance.

## Storage and tooling

Retain one compact acceptance checkpoint with the tested artifact identity, environment, exercised scope, outcome, and remaining gates. Keep useful production and routine regressions and their portable fixtures. Use Git history for a completed campaign. Keep raw logs and screenshots only while they are required for an active investigation. Remove generated consumers, dependencies, build caches, frozen candidate archives, old binaries, and redundant downloads when a checkpoint ends or is deferred. An immutable input is required during an approved run. It does not require permanent storage of that workspace.

Reuse ordinary TypeScript, formatting, unit, component, browser, and native test tools. Keep native backend consumer apps separate where selected linking requires it. Reuse fixtures and scenario intent. Add test tooling only when the implemented feature needs it.

`validate` runs routine checks only. It does not launch a browser, Metro session, simulator, or native build.
