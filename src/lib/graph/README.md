# Graph building module

- `index.ts` - orchestrates the single-paper build (`buildGraph`) and author build (`buildAuthorGraph`), plus metadata hydration for slim-cached graphs.
- `multiGraph.ts` - multi-paper build (`buildMultiGraph`): treats N input papers as the reference list of a virtual source and runs the roots/branches algorithm once around the whole set. API cost is comparable to a single-paper build regardless of N.
- `apiClient.ts` - shared rate-limited `apiFetch` wrapper (8 req/s, retry on 429) plus API call counting. All OpenAlex requests must go through this.
- `openAlexApi.ts` - OpenAlex request helpers: single/bulk paper fetching (full and slim field sets), citation queries, author works, autocomplete, DOI parsing.
- `bibliography.ts` - local extraction of DOIs and arXiv IDs from pasted bibliography text (BBL/BibTeX/plain), and batch resolution to OpenAlex works.
- `ranking.ts` - root and branch ranking heuristics (cited-by-seeds, co-citation, co-citing, recency weighting).
- `preprocessing.ts` - converts a `RawGraph` to the app's `ProcessedGraph` format, builds edges, marks source nodes (single or multi).
- `paperFormatter.ts` - converts OpenAlex work responses to `RawPaper` / `SlimPaper`.

## Build modes

1. Single paper: roots from refs-of-refs of the source, branches from papers citing it.
2. Author: all of an author's works, edges between works that cite each other.
3. Multi-paper: the inputs act as root seeds of a virtual source; branch seeds are papers citing several inputs. All inputs are flagged `isSource`.
