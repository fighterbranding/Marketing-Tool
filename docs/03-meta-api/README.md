# Meta API layer overview

These docs cover the four Graph API surfaces this platform uses. All of them are accessed through the same shared `meta-client` service in the backend (see [02-backend/README.md](../02-backend/README.md)) — same auth header injection, same rate-limit handling, same error normalization.

| API | File | Used for |
|---|---|---|
| Marketing API | [marketing-api.md](marketing-api.md) | Create/edit/pause campaigns, ad sets, ads |
| Insights API | [insights-api.md](insights-api.md) | Performance metrics |
| Pages API | [pages-api.md](pages-api.md) | Facebook Page, Instagram Business account data |
| Business Manager API | [business-manager-api.md](business-manager-api.md) | Linking client accounts, asset permissions |

## Shared concepts across all four

**API versioning.** Meta deprecates Graph API versions roughly every 2 years. Pin a version in `.env` (`META_API_VERSION`) and set a calendar reminder to migrate before it sunsets — don't hardcode the version string throughout your codebase.

**Pagination.** Every list-returning endpoint uses cursor-based pagination (`paging.cursors.after`). The official SDK handles this for you in most cases, but if you ever call the Graph API directly with `axios`, you must follow `paging.next` until it's absent.

**Field expansion.** You can request nested fields in one call (e.g. a campaign with its ad sets and their insights) using the `fields` query param with nested syntax. Use this to reduce round trips, but don't over-nest — very deep field expansion can time out on accounts with large data volumes.

**Error codes worth knowing:**
- `190` — token expired or invalid → trigger reconnect flow
- `17` / `4` — rate limit hit → back off (see sync-engine.md)
- `100` — invalid parameter, usually a field name typo or unsupported field for that object type
- `200` — permission error → the connected token doesn't have the required scope for this object
