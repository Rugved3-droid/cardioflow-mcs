"""Front matter, legends and letters for the ASAIO submission. Imported by scripts/build_manuscript.py."""

TITLE = 'Paired-State Simulation of Temporary Mechanical Circulatory Support'
TITLE_ALTERNATIVES = [
    'Paired-State Simulation of Temporary Mechanical Circulatory Support',   # recommended (7 words)
    'Verifying a Paired-State Mechanical Circulatory Support Simulator',     # 7
    'CardioFlow Twin: Verification Against Device Benchmarks',               # 6
    'Benchmarking an Open Temporary Circulatory Support Simulator',          # 7
    'Simulated ECMO, Impella, and Balloon Pump Hemodynamics',                # 7
]
RUNNING_HEAD = 'Paired-State MCS Simulation'

AUTHORS = [
    ('Rugved Parmar, MBBS', '1', 'ORCID: https://orcid.org/0009-0005-8941-3745'),
    ('Md Fahim, [DEGREE]', '1', 'ORCID: [ORCID]'),
    ('Shreya P. Trivedi, MD', '2', 'ORCID: https://orcid.org/0000-0001-7183-0624'),
]
AFFILIATIONS = [
    ('1', 'Department of Medicine, SUNY Downstate Health Sciences University / Kings County Hospital Center, Brooklyn, NY, USA'),
    ('2', 'Beth Israel Deaconess Medical Center / Harvard Medical School, Boston, MA, USA'),
]
CORRESPONDING = ('Rugved Parmar, MBBS', 'Department of Medicine, SUNY Downstate Health Sciences University / Kings County Hospital Center, Brooklyn, NY, USA',
                 'parmarrugved@gmail.com')
FUNDING = 'None.'
COI = 'The authors declare no conflicts of interest.'
AUTHOR_CONTRIBUTIONS = ('R.P. conceived the study, developed the software, performed the verification analyses and drafted the manuscript. '
                        'M.F. reviewed the software, contributed to validation and critically revised the manuscript. '
                        'S.P.T. supervised the work and critically revised the manuscript. All authors approved the final version.')

LEGENDS = [
    ('Figure 1.', 'Model structure and paired-state display. (A) Seven-compartment closed-loop model. Solid arrows, native circulation; '
     'dashed arrows, devices (Impella-class pump from left ventricle [LV] to aortic root on a linear pressure head–flow line; venoarterial extracorporeal '
     'membrane oxygenation [VA-ECMO] as a set flow from systemic veins to systemic arteries); the intra-aortic balloon pump (IABP) displaces 40 mL within the '
     'systemic arterial compliance; dotted arrow, bronchial shunt. The baroreflex acts on systemic vascular resistance (SVR). AV, aortic valve; C, compliance; '
     'E(t), time-varying elastance; EDPVR, end-diastolic pressure–volume relation; LA, left atrium; MV, mitral valve; PV, pulmonic valve; PVR, pulmonary '
     'vascular resistance; Rc, characteristic impedance; RV, right ventricle; TV, tricuspid valve. (B) Paired-difference column of the released application in compare mode after both panes settled: pane A, VA-ECMO 4 L/min; pane B, the same patient with Impella P5 added (a single setting differs). Each row shows B − A (MAP, mmHg; total flow, L/min; SVR, Wood units; LVEDP, mmHg; LVEDV, mL; native stroke volume [SV], mL; aortic valve [AV] opening, % of cycle; pressure–volume area [PVA], mmHg·mL), as rounded by the application. The full screen is shown in SDC Figure S2.'),
    ('Figure 2.', 'Left ventricular response to increasing VA-ECMO flow, model vs benchmarks. Percent change from each series\' lowest flow in (A) end-diastolic '
     'volume, (B) end-systolic volume, (C) end-diastolic pressure and (D) stroke volume (end-diastolic minus end-systolic volume). Lines, model with the '
     'baroreflex on (solid, primary) and off (dashed, sensitivity); model baseline is no support. Open circles, Ostadal et al. (porcine acute shock, '
     'consistency source; baseline 1 L/min); filled squares, Hála et al. (porcine chronic heart failure, independent source; baseline 0.3 L/min); open diamonds, '
     'Donker et al. simulation at 4 L/min (consistency source). Animal data are compared by direction and percent change only.'),
    ('Figure 3.', 'Simulated left ventricular pressure–volume loops (baroreflex on). (A) Increasing VA-ECMO flow (no support, 2, 4 and 6 L/min). '
     '(B) Unloading on VA-ECMO 4 L/min: ECMO alone, with IABP, and with Impella P5 or P8. One steady-state beat at 1-ms resolution.'),
    ('Figure 4.', 'Dose–response of Impella-class support on VA-ECMO 4 L/min compared with the IABP. (A) Pump flow achieved at each performance level '
     '(P2–P8). (B) Change in left ventricular end-diastolic pressure (LVEDP) and (C) mean left atrial pressure (LAP, the model\'s surrogate for pulmonary '
     'capillary wedge pressure) relative to ECMO alone. (D) Native (aortic-valve) stroke volume (SV). Horizontal lines, IABP (40 mL) and ECMO alone. Solid '
     'lines and filled markers, baroreflex on (primary); dashed lines and open markers, baroreflex off. The IABP unloads comparably or more at P5 and below '
     '(≤2.2 L/min); the Impella unloads more from P6 (2.6 L/min) upward.'),
]

COVER_LETTER = """{date}

Editor-in-Chief
ASAIO Journal

Dear Editor,

We submit "{title}" for consideration as an Original Article in ASAIO Journal.

Simulators of temporary mechanical circulatory support are increasingly used to reason about how VA-ECMO, Impella-class pumps and intra-aortic balloon pumps change left ventricular loading, yet few are reported with a verification record, and fewer separate the data used to build a model from the data used to test it. We report the verification of CardioFlow Twin, an open-source, browser-based simulator that runs two identical copies of one cardiogenic-shock patient differing in a single device setting. Beyond numerical verification of the solver, we made 67 comparisons of simulated device effects with published benchmarks, classified in advance as consistency sources (the model's source model and calibration anchors) or independent porcine studies. The model reproduced the direction of 24 of 29 effects against independent data, and we report every disagreement and its likely cause. We also report the full Impella dose–response on ECMO rather than a single selected level, showing that balloon pumping and the Impella unload comparably at low pump flow and that the Impella is superior above 2.6 L/min.

The work fits ASAIO Journal's readership in circulatory support and biomedical engineering, and it builds directly on simulation and animal work published in the journal and its community. The code, verification scripts, extracted benchmark values and results are publicly available at https://github.com/Rugved3-droid/cardioflow-mcs (tag {tag}, commit {hash}). The study is in silico and involved no human or animal participants. The manuscript has not been published and is not under consideration elsewhere. All authors approved the submission. Funding and conflicts of interest are stated on the title page.

Sincerely,

Rugved Parmar, MBBS
Department of Medicine, SUNY Downstate Health Sciences University / Kings County Hospital Center
Brooklyn, NY, USA
parmarrugved@gmail.com
on behalf of Md Fahim and Shreya P. Trivedi
"""
