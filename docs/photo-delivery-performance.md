# Public photo delivery diagnostics

Public vehicle photo responses expose a bounded `Server-Timing` header on successful image responses and conditional 304 responses. The website proxy forwards only the numeric photo-stage allowlist. No credentials, SQL, database hosts, storage keys, paths or user data are included.

| Metric                                 | Meaning                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `photo-check`                          | Wall-clock time awaiting the live public-availability and approved-photo query, including any shared in-flight wait. Not database execution time alone.                              |
| `photo-cache-hit` / `photo-cache-miss` | Pixel cache outcome; zero duration is a marker, not a measured lookup duration.                                                                                                      |
| `photo-manifest`                       | Selecting the existing derivative, including the manifest cache/storage lookup. Absent on a pixel cache hit or original request.                                                     |
| `photo-storage`                        | Downloading the selected file and reading its bytes, including original fallback if required. Absent on a pixel cache hit.                                                           |
| `photo-total`                          | Total route preparation from availability lookup through ready image bytes. Includes the stages above; do not add it to them. Excludes internet transfer and website proxy overhead. |

Read the header in the image request's Network response headers/Timing panel, or in an HTTP client. Each request reports its own current timings; this is not a public historical log. Deployment is required before the public domain exposes these metrics.

Compare first reads, immediate repeat reads and conditional requests separately, using the same image and width. Keep live authorization for every request and 304, the existing private revalidation policy, byte limits, MIME validation and immutable pixel identity. These diagnostics do not resize or recompress photos.

Before instrumentation, short public samples showed about 173 ms to obtain current photo authorization versus 63 ms for the no-database health response. Warm image response headers were about 172 ms through the backend versus 175 ms through the website. These are external observations, not an exact production database breakdown. Separate local-process measurements must not be presented as production-internal timings.
