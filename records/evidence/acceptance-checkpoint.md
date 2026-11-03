# Deferred acceptance checkpoint

Acceptance is deferred until the owner prepares a release or explicitly requests it. This checkpoint preserves results for the historical f05 candidate only. The working source and SDK dependencies have since changed; these results do not certify the checkout or establish publication readiness.

| Tested input | SHA-256 |
| --- | --- |
| f05 package archive | `33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276` |
| Built library | `f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5` |

| Environment | Recorded exercised scope |
| --- | --- |
| Browser, Mapbox and MapLibre | All nine approved rows passed. |
| Android API36, Mapbox | Camera attempt24, core attempt27 and six retained scenarios attempt29 passed. |
| Android API36, MapLibre | Camera attempt30, core attempt31 and six retained scenarios attempt32 passed. |
| iOS, both backends | Complete batches deferred. |
| Aggregate density gate | Deferred; two distinct positive observed scales per engine remain unproved. |

Results retain their original scope and exclusions. They do not certify general upstream SDK behavior, physical devices, full VoiceOver/TalkBack behavior or the two owner-excluded RNMapbox cache operations. Prior failures and unresolved diagnostic causes are not retroactively passed. The retained Android observations used scale2.625; that single scale does not complete the density gate.

[Git history](https://github.com/RobJacobson/one-map-react/commit/7eb042e) and [PR100](https://github.com/RobJacobson/one-map-react/pull/100)/[PR101](https://github.com/RobJacobson/one-map-react/pull/101) preserve detailed attempts and repairs. Candidate archives, generated consumers, per-attempt packets, raw logs and screenshots are not permanent requirements. See the [testing policy](../../docs/testing-policy.md) for future approval, impact review and retention.
