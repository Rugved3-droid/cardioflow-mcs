# Benchmarks

Put source PDFs in `pdfs/`. Values are extracted by hand from those PDFs ONLY, never from memory or the web.

## Files to be created after the PDFs arrive

`reference_ranges.csv` (supplied by the author):

    variable,condition,low,high,units,source,page_or_table

`variable` must match the names in `paper/results/v2_baseline.csv` (MAP, CO, LVEDP, LVEDV, LVESV, EF, PCWP_equiv_meanLAP, SVR_equiv, ...). `condition` is `cardiogenic_shock` or `normal`.

`device_benchmarks.csv` (extracted by Claude from the PDFs, one row per reported value or direction):

    source_id,source_pdf,table_or_figure,page,scenario,comparison_id,outcome,reported_direction,reported_baseline,reported_value,reported_pct_change,units,read_quality,notes

- `comparison_id` maps to the IDs in `paper/results/v3_model_directions.csv` (C1_ECMO4_vs_none, C2_ECMO4+IABP_vs_ECMO4, C3_..., C4_..., C5_...).
- `read_quality` is `exact` (a table value), `figure_read` (digitized from a plot, approximate) or `UNCLEAR` (not used until the author resolves it).
- `calibration_overlap` must be noted: any source used to set model parameters (Donker 2019, Ostadal 2015; see `patient.ts:52-56`) is flagged and reported separately, not counted as independent verification.


## Second pass (2026-11-14): what is here now
- `xml/` Europe PMC JATS full texts; `text/` plain-text renders (`scripts/xml_to_text.py`); `pdfs/` PDFs that downloaded; `img/` table/figure images read for values.
- `device_benchmarks.csv` and per-source `<key>.csv` are written by `scripts/build_benchmarks.py`, which is the extraction record (every value with its table/figure/text location). The schema is in that script's docstring and supersedes the draft schema above.
- `reference_ranges.csv`: V2 reference values (human-simulation point values plus porcine mean ± SD, context only).
- `ecmo_sweeps.csv`: full Ostadal and Hála flow sweeps, used for figure overlays only.
- Møller-Helgestad publisher HTML, its text render and its table images are git-ignored (not in the PMC open-access subset). Rerunning `build_benchmarks.py` does not need them.
