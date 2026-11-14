# Parameter provenance (CardioFlow Twin, shipped model)

Sources searched: every comment in `src/model/`, `README.md` (sections "LV afterload response calibration" and "Baroreflex"), `validation/report.md`, and the full git history (`git log --all --grep`). Commits cited by hash. The code is the truth. Where a comment and the code disagree, the code value is listed.

**Bottom line for the paper.** No CardioFlow parameter was copied from Donker 2019, Broomé 2016 or Ostadal 2015. Several were **chosen so that model outputs would match targets taken from Donker 2019 and Ostadal 2015**. Comparisons against those two sources are therefore *consistency with calibration anchors*, never independent validation. Hála 2020, Nix 2020 (Frontiers) and Møller-Helgestad 2019 were not used anywhere in the code or the git history before this paper branch, so they are independent.

| Parameter (file:line) | Value | How it was set | Source dependence |
|---|---|---|---|
| `lvA`, `lvB`, `lvV0ed` (`src/model/patient.ts:52-58`) | 8.0, 0.0093, 53 | Chosen so local diastolic stiffness dP/dV ≈ 0.26 mmHg/mL at the operating point, "the value implied by Donker 2019 (+10% EDV for +5 mmHg PCWP at 4 L/min)" (code comment; commit `8769c12`) | **Donker 2019 (output target)** |
| `lvEes` (`patient.ts:48`) | 0.62 mmHg/mL | Raised 0.5 → 0.62 to give Ea/Ees ≈ 4 after "Ostadal 2015 measured stroke work RISING x1.45 with ECMO flow where this model fell x0.25" (commit `8769c12`) | **Ostadal 2015 (output direction)** and the internal Ea/Ees design target |
| `lvV0` (`patient.ts:50`) | 40 mL | Internal; split from the EDPVR intercept in `8769c12` | indirect (same recalibration) |
| Baroreflex: `baroEnabled`, `baroSetpoint` 68, `baroK` 12, `svrMin` 0.45, `svrMax` 1.25, `baroSenseTau` 2 s, `baroEffectorTau` 8 s (`patient.ts:73-84`; `src/model/baroreflex.ts`) | — | Setpoint chosen so the reflex output at the unsupported state equals the pre-existing SVR (0.96 mmHg·s/mL). The reflex was **added** after Task D left ΔLVEDP at S3 (+12.9 mmHg) above the "+5 to +10 target"; with the reflex, ΔLVEDP = +6.5, "inside the +5 to +10 target" (commit `9c569ff`). The gain is a modelling assumption (`baroreflex.ts`, last comment) | **Donker 2019 (output target for the ECMO ΔLVEDP window)**. Note that Donker's own model has **no** reflexes (Donker SDC Appendix) |
| `rSvr`, `cSa`, `cAo`, `rc`, `cSv`, `cPa`, `rPvr`, `cPv`, `rBronchial`, valve resistances, RV parameters, `v0` volumes, `hr` (`patient.ts:61-99`) | — | "Internal choices tuned so the unsupported state lands in a textbook SCAI C–D cardiogenic-shock profile ... NOT fitted to any patient or dataset" (`patient.ts:1-7`). `rc` and `cSa` were checked and ruled out as drivers of the afterload response in `8769c12` | none found |
| `hr` = 100 bpm | 100 | Internal. Coincides with Donker's 100 bpm, but there is no comment or commit linking them | none documented |
| Impella `H_MAX` 200 mmHg, `K` 2.2 mmHg/(mL/s), suction band 45/5 mL (`src/model/devices/impella.ts:21-25`) | — | "Illustrative values chosen so P2..P8 span roughly 0.5–3.5 L/min at typical shock pressures. They are NOT manufacturer H-Q curves" (`impella.ts:16-18`) | none (no source) |
| ECPELLA level P5 (`src/model/therapyStates.ts:21`) | 5 | Chosen for on-screen legibility: the valve keeps opening (commit `9c569ff`) | none |
| IABP `BALLOON_VOLUME_ML` 40, inflate 60 ms, deflate 50 ms, lead 20 ms (`src/model/devices/iabp.ts:20-23`) | — | Internal; 40 mL is the common adult balloon size. Donker 2019 used 30 mL with partial occlusion of a descending-aortic segment (Donker SDC Appendix) | none |
| ECMO `DRAIN_ZERO_MMHG` 0.5, `DRAIN_FULL_MMHG` 3.5 (`src/model/devices/ecmo.ts:14-15`) | — | Internal. ECMO is an ideal flow source with no pump curve. Donker likewise modeled ECMO as a fixed flow (Donker SDC Appendix, "ECMO simulation") | none |

**Validation checks that reference these sources** (`validation/report.md`): the diastolic-stiffness check cites Donker 2019; E8 cites Ostadal 2015; answer-key items cite Ostadal 2015, Donker 2019, Burkhoff 2015 and Ezad 2023.

**Classification used in V3:** consistency = Donker 2019 (simulation), Donker 2019 review (it summarises the same model's results), Broomé 2016 (the same model, fitted to Ostadal 2015), Ostadal 2015. Independent = Hála 2020, Nix 2020 (Frontiers), Møller-Helgestad 2019.
