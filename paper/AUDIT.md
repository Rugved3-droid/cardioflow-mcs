# AUDIT: ASAIO submission package (CardioFlow Twin)

Built 2026-11-14 on branch `paper/asaio-verification` (not merged to main). The code state described by the manuscript is tag `v1.0-asaio` = commit `97f5f0b3d7a30296a8672894bb36ecc9cd65b654`. `src/` is unchanged throughout the paper work (last model change `6d74829`).

## How to rebuild
`make -C paper paper` or `python paper/scripts/make_paper.py` (add `--skip-verification` to reuse the V1–V5 results). Requires Node/npx tsx, Python 3 (pandas, matplotlib, python-docx, python-pptx, markdown, Pillow) and Chrome.

## Number provenance
- **Manuscript text:** `paper/scripts/verify_numbers.py` recomputes 56 quantitative claims from `paper/results/` and checks that each formatted value appears in `paper/manuscript/manuscript.md`. Result: **56/56** (`results/number_audit.csv`).
- **Figures** (`scripts/fig_submission.py`), **tables** (`scripts/build_tables.py`), **SDC** (`scripts/build_sdc.py`) and the **visual abstract** (`scripts/build_visual_abstract.py`) all read their values from `results/` and `benchmarks/`. No number is typed by hand, except the parameter values in Table 1, which are cited by file:line in `src/model`.
- **Benchmark values** come only from downloaded sources. Each one is recorded with its table, figure or text location in `scripts/build_benchmarks.py` (→ `benchmarks/*.csv`). Burkhoff 2015, Thiele 2023 and Møller 2024 are background citations only.
- **Correction found by the audit:** volume drift was reported as 2.2×10⁻⁹ mL in the Phase 1 report. The CSV maximum is 2.03×10⁻⁹ mL (S4). Corrected to 2.0×10⁻⁹ in the manuscript and report after the tag. The tagged `verification_report.md` still carries the old text, but the tagged results are correct.

## Rules followed
- No parameter was retuned; mismatch 2 was diagnosed as faithful behavior, so no fix branch was created.
- Consistency and independent sources are separated in every table and figure.
- Animal data are compared by direction and % only.
- Nix 2020 is flagged as industry-funded wherever it is cited.
- Møller-Helgestad publisher HTML, images and text renders are git-ignored; only the extracted values, with their source locations, are committed.
- No Zenodo or DOI placeholder exists in any file (grep, 2026-11-14); code is cited by GitHub URL, tag and commit.
- Citations come only from `references_provided.bib`: 20 used, 0 [CITE NEEDED]. The 10 references added on 2026-11-14 were each verified against their Crossref record (title, journal, volume, pages, year, authors) and stored with DOIs.
- License: MIT (`LICENSE`, copyright 2026 Rugved Parmar), reflected in README and CITATION.cff.

## Package (`paper/submission/`)
| File | Content |
|---|---|
| Manuscript.docx | abstract (193 words), keywords, main text (2,204 words), 20 references (ASAIO style), figure legends, SDC callout; Arial 12, double-spaced, line and page numbers |
| TitlePage.docx | title, authors and affiliations, corresponding author, ORCID placeholders, running head, funding, COI, contributions, code availability, ethics line |
| tables/Table1–3.docx | key parameters and provenance; concordance by source and class; disagreements |
| figures/Figure1–4.tif | CMYK, LZW. Figures 2–4 are line art at 1200 dpi; Figure 1 (schematic + screenshot crop) is a combination figure at 600 dpi. All text is ≥ 12 pt at print size, including the Figure 1B crop (smallest on-screen text 12.3 pt, asserted by the script) |
| SDC1.pdf | equations, full parameters, numerical verification, P1–P9 sweep, baseline comparison, all 67 benchmark rows with source locations, reflex on/off, balloon volume, tornado, provenance, extraction |
| VisualAbstract.pptx | built in the ASAIO template (slide 1 layout); text fit checked by font metrics (`check_visual_abstract.py`) and by a PowerPoint render (VisualAbstract.png) |
| SDC_Video_1.mp4 | demonstration video, 9.1 MB, 960×540 H.264 (compressed from https://youtu.be/sHLgmfZxZZM); legend in SDC1.pdf. Recorded 2026-10-06/07 from release/CardioFlow-MCS.html, which is unchanged at tag v1.0-asaio (release/ and src/ last changed 2026-09-28), so the build matches the tag |
| VisualAbstract.png | PowerPoint export of the visual abstract (checked: all text fits) |
| CardioFlow_coauthor_review.pdf | co-author review copy (title page, manuscript, tables, figures, SDC). Word COM hangs on this machine, so the .docx content is rendered through Chrome; not for upload |
| CoverLetter.docx, word_count.txt, references_used.txt | |

## Word counts
- Draft 1: abstract 213, main text 2,475.
- After the cutting pass: abstract 193, main text 2,043 (−17.5%).
- Two substantive passages were then added back (the EF divergence result and the scope of directional verification), giving 2,159; the simulator sentence added to the Introduction with the new references brings it to 2,192; the Video 1 call-out and the demonstration-video sentence give the final 2,204.
- This is below the 2,600–2,800 target but within the 3,500 limit.
