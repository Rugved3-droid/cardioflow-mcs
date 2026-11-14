"""One-command rebuild of the ASAIO paper (the `make paper` target). Run from the repo root:
    python paper/scripts/make_paper.py [--skip-verification]
Order: P0 equivalence, V1-V5, benchmarks + V2/V3, mismatch analyses, figures, tables, screenshot, manuscript, SDC, visual abstract.
Requires Node (npx tsx), Python 3 with pandas/matplotlib/python-docx/python-pptx/markdown/Pillow, and Chrome (CHROME env var)."""
import subprocess, sys
SKIP = '--skip-verification' in sys.argv
TS = lambda s, *a: ['npx', 'tsx', f'paper/scripts/{s}', *a]
PY = lambda s: [sys.executable, '-I', f'paper/scripts/{s}']
steps = []
if not SKIP:
    steps += [TS('p0_equivalence.ts'), TS('v1_convergence.ts'), TS('v1_limitcycle_conservation.ts'), TS('v3_devices.ts'), TS('v3_iabp_1to2.ts')]
    steps += [TS('v4_sensitivity.ts', str(i), '4') for i in range(4)] + [TS('v4_sensitivity.ts', 'aggregate'), TS('v5_twin.ts')]
steps += [PY('build_benchmarks.py'), TS('v2_baseline.ts'), TS('v3_concordance.ts'), TS('v3_sweep.ts'), TS('m2_impella_vs_iabp.ts'),
          PY('m3_reflex_table.py'), PY('fig_phase1.py'), PY('fig_v3_benchmarks.py'), TS('screenshot_twin.ts'), PY('fig_submission.py'),
          PY('build_tables.py'), PY('build_manuscript.py'), PY('build_sdc.py'), TS('html_to_pdf.ts'), PY('build_visual_abstract.py'), PY('check_visual_abstract.py'), PY('verify_numbers.py'), PY('build_review_pdf.py')]
for cmd in steps:
    print('>>', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True, shell=(cmd[0] == 'npx'))
print('paper rebuilt: paper/submission/')
