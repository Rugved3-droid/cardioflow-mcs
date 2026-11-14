# TODO / open items (ASAIO verification paper)

## Author decisions recorded (2026-11-14)
- V2: shock baseline only; no normal baseline. Limitations: "no normal-physiology calibration".
- Donker 2019 (confirmed = PMC6325768) and Ostadal 2015: reported as **consistency with the source model or calibration anchors**, never validation. Provenance: `paper/parameter_provenance.md`.
- EF: EF_native = native SV / LVEDV is primary. LV emptying fraction is secondary and never labeled EF. Native AV flow and opening fraction are reported alongside.
- Benchmarks (second pass):
  - Only downloaded sources are used.
  - Burkhoff 2015 is background only.
  - Animal data are compared by direction and % only.
  - V2 reference values come only from the benchmark papers' shock baselines.
- Mismatch 2: no code fix. There is no code error, wrong unit or documented device characteristic to justify one (see `verification_report.md`). `fix/impella-model` was not created.

## Benchmark sources: status
| Key | XML | PDF | Notes |
|---|---|---|---|
| donker2019simulation | yes | **NO** | The Europe PMC render and the PMC /pdf/ URLs return 403 or a JS challenge page. The XML has the full text. Table 1 was taken from the XML graphic. SDC Appendix downloaded as .docx (`pdfs/donker2019simulation_SDC.docx`). |
| donker2019review | yes | **NO** | Same failure as above. Full text from the XML. |
| broome2016 | yes | yes | |
| ostadal2015 | yes | yes | |
| hala2020 | yes | yes | |
| frontiers2020impella (Nix 2020, PMC7299088) | yes | yes | Abiomed-funded study; disclose when citing. |
| mollerhelgestad2019 | not in PMC OA | **NO** (no PDF link) | Full text is free on the publisher page (`benchmarks/mollerhelgestad2019_landing.html`). Tables 1–2 were read from the publisher images in `benchmarks/img/`. **Author: confirm you are comfortable citing it as open (Europe PMC flags isOpenAccess = N).** |
| Visual_Abstract_Templates.pptx | — | downloaded | `paper/Visual_Abstract_Templates.pptx` |

## Open items for the author
1. [ ] **Reflex arm for the headline numbers.** Should the manuscript lead with reflex-on (shipped) magnitudes, with reflex-off as sensitivity? That is the current default in the report.
2. [ ] **S4 = Impella P5.** P5 was chosen for on-screen legibility. On ECMO 4 it delivers 2.2 L/min, and that is what produces mismatch 2. Options:
   - (a) keep P5 and state the reason;
   - (b) report P6 or P8 for ECpella in the paper. This needs no code change; it is a scenario choice in `paper/runner/scenarios.ts`.
3. [ ] **Møller-Helgestad open-access status** (see table above).
4. [ ] `paper/old_medteacher.docx` for affiliations (not found).
5. [ ] Demo video file (optional SDC).
6. [ ] `paper/asaio_guide.md` (not supplied; Phase 3 will use the template and public instructions only if you agree).

## Remaining unbenchmarked or unresolved model behaviors
- AV opening fraction under ECMO: none of the downloaded sources reports it.
- Stroke work under ECMO: the model falls while both porcine studies rise. This is phenotype-contingent (README E8). Reported as a discordance.
- Independent discordances: SV maintenance (Hála), mPAP fall on ECMO (Nix), and LV peak pressure rise on Impella with norepinephrine (Møller-Helgestad).
- The model cannot reach Impella 5.0 flows on ECMO (maximum 3.8 L/min).

## [CITE NEEDED] log
(none yet; no manuscript text drafted)
