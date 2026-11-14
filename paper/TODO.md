# TODO / open items (ASAIO verification paper)

## Author decisions recorded (2026-11-14)
- V2: shock baseline vs reference SHOCK ranges only. No normal baseline. Limitations line: "no normal-physiology calibration".
- Donker 2019: if confirmed as PMC6325768 and as a source of CardioFlow parameters, report that comparison as **"consistency with the source model"**, never as validation. State parameter provenance explicitly in Methods.
- EF: primary metric is EF_native = native (aortic-valve) SV / LVEDV. LV emptying fraction = (LVEDV − Vmin)/LVEDV is reported as a secondary metric and is never labeled EF. Both apply identically to all scenarios. Native AV flow (SV, CO) and the AV opening fraction are reported alongside. (`paper/runner/core.ts` `efMetrics`)

## Needed from the author: benchmarks
1. [ ] **PMC6325768 PDF** into `paper/benchmarks/pdfs/`, plus confirmation that it is Donker et al. 2019. Include its supplement if the scenario parameters or tables are there.
2. [ ] **Parameter provenance confirmation.** Which CardioFlow parameters derive from Donker 2019? From the code: the LV EDPVR (A, B, V0,ed) were set so that local diastolic stiffness matches "+10% EDV for +5 mmHg PCWP at 4 L/min" (`patient.ts:52-56`; commit `8769c12`). Ees was set by an Ea/Ees target and Ostadal 2015. Confirm whether anything else (for example the baroreflex or the venous parameters) was taken from Donker.
3. [ ] **Ostadal 2015 PDF.** It was also a Task D calibration anchor (the stroke-work direction), so it goes in the same "source-model consistency" category, not independent verification.
4. [ ] **Burkhoff 2015 (JACC) PDF.** This is the first independent benchmark (qualitative device effects). I need the exact table or figure pages with the per-device hemodynamic directions (VA-ECMO, IABP, Impella, ECMO + unloading).
5. [ ] **At least one more independent quantitative source** that the model was NOT built from, ideally reporting LVEDP/PCWP, LVEDV, MAP, native SV/CO and AV opening before and after device support. Any of these would work:
   - a clinical hemodynamic series on VA-ECMO with PV or catheter data;
   - an animal (porcine or ovine) study of an ECMO flow sweep or ECMO + unloading. It must not be Ostadal 2015;
   - a clinical or animal study of IABP or Impella hemodynamic effects in cardiogenic shock.
   For each, I need the PDF and the specific tables or figures.
6. [ ] **`paper/benchmarks/reference_ranges.csv`** for cardiogenic shock only (columns: `variable,condition,low,high,units,source,page_or_table`; condition = `cardiogenic_shock`). Variable names must match `paper/results/v2_baseline.csv` (MAP, CO, SV, LVEDP, LVEDV, LVESV, EF_native, PCWP_equiv_meanLAP, RAP_equiv_meanSVpressure, mPAP, SVR_equiv, HR).

## Other inputs not yet present
- [ ] `paper/references_provided.bib`
- [ ] `paper/asaio_guide.md`
- [ ] `paper/Visual_Abstract_Templates.pptx` (required; stop and ask if missing)
- [ ] `paper/old_medteacher.docx` for affiliations (not found)
- [ ] Demo video file (optional SDC)

## Benchmark extraction rules (for when the PDFs arrive)
- Values come only from the PDFs and go into `paper/benchmarks/device_benchmarks.csv` with page and table/figure for each.
- Ambiguous readings are marked `UNCLEAR` and raised with the author.
- `calibration_overlap = yes` for Donker 2019 and Ostadal 2015. `v3_concordance.ts` reports those separately as source-model consistency and never pools them with independent concordance.

## [CITE NEEDED] log
(none yet; no manuscript text drafted)
