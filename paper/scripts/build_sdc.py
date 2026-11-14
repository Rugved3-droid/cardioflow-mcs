"""Supplemental Digital Content (SDC) for the ASAIO submission, as HTML -> PDF (Chrome, scripts/html_to_pdf.ts).
Content is assembled from paper/model_spec.md, paper/verification_report.md, paper/parameter_provenance.md and result CSVs;
no number is typed here. Run: python -I paper/scripts/build_sdc.py  then  npx tsx paper/scripts/html_to_pdf.ts"""
import base64, pathlib, re, subprocess
import markdown
import pandas as pd

P = pathlib.Path(__file__).resolve().parent.parent
R = P / 'results'
OUT = P / 'submission'; OUT.mkdir(exist_ok=True)
TAG = 'v1.0-asaio'
HASH = subprocess.run(['git', 'rev-list', '-n', '1', TAG], cwd=P.parent, capture_output=True, text=True, check=True).stdout.strip()


def section(md_text, start, end=None):
    i = md_text.index(start)
    j = md_text.index(end, i + 1) if end else len(md_text)
    return md_text[i:j]


def demote(md_text, by=1):
    return re.sub(r'^(#+)', lambda m: '#' * min(6, len(m.group(1)) + by), md_text, flags=re.M)


def table(df, fmt=4):
    df = df.copy()
    for c in df.columns:
        if pd.api.types.is_float_dtype(df[c]):
            df[c] = df[c].map(lambda x: '' if pd.isna(x) else f'{x:.{fmt}g}')
    return df.to_html(index=False, border=0, classes='t', na_rep='')


spec = (P / 'model_spec.md').read_text(encoding='utf8')
rep = (P / 'verification_report.md').read_text(encoding='utf8')
prov = (P / 'parameter_provenance.md').read_text(encoding='utf8')

parts = [f"""# Supplemental Digital Content 1
**Paired-State Simulation of Temporary Mechanical Circulatory Support.** Code and every result: https://github.com/Rugved3-droid/cardioflow-mcs (tag {TAG}, commit {HASH}).
File:line references point to that commit. All numbers below were written by scripts in `paper/scripts/` to `paper/results/`.
"""]
parts.append('# Section S1. Model equations\n' + demote(section(spec, '## 1. Topology', '## 6. Parameters')))
parts.append('# Table S1. Full parameter set\n' + demote(section(spec, '## 6. Parameters', '## 7. Physiology')))
parts.append('# Table S2. Numerical verification (Phase 0, V1, V5)\n' + demote(section(rep, '## Phase 0.', '## V2.')) + '\n' + demote(section(rep, '## V5.', '---\n\n## Mismatch')))
m2 = pd.read_csv(R / 'm2_impella_vs_iabp.csv')
cols = ['arm', 'reflex', 'impella_Lpm', 'map', 'lvedp', 'lvedv', 'nativeSv', 'lvEmptyingSv', 'efNative', 'avOpen', 'lapMean', 'd_lvedp', 'd_lvedv_pct', 'd_lap']
parts.append('# Table S3. Impella P1–P9 and IABP on VA-ECMO 4 L/min, and single devices without ECMO\n'
             'Deltas are relative to ECMO 4 alone (rows ECMO4+…) or to no support (rows without ECMO). Source: `results/m2_impella_vs_iabp.csv`.\n\n' + table(m2[cols], 3))
v2 = pd.read_csv(R / 'v2_baseline.csv')
parts.append('# Table S4. Unsupported baseline vs shock baselines in the benchmark sources\n'
             'Human-simulation values (Donker 2019) are point values; porcine values are mean ± SD (SEM × √5) and are context only (no cross-species verdict). Source: `results/v2_baseline.csv`.\n\n'
             + table(v2[['variable', 'units', 'model_value', 'ref_low', 'ref_high', 'ref_source', 'species', 'verdict']], 4))
c = pd.read_csv(R / 'v3_concordance.csv'); c = c[c.reflex == 'on']
parts.append('# Table S5. Benchmark concordance, all 67 comparisons (baroreflex on)\n'
             'Rules: direction scored; model change <1% = flat; benchmark flat concordant if |model change| <1 unit; rank rows compare the change in pair 1 minus pair 2; '
             'relative magnitude = model % / benchmark % (not scored). Class: consistency = source model or calibration anchor; independent = not used in development. '
             'Reflex-off results are in `results/v3_concordance.csv`. Each value\'s location in its source is in the last column.\n\n'
             + table(c[['comp_id', 'class', 'outcome', 'benchmark_contrast', 'model_contrast', 'bench_base', 'bench_int', 'units', 'bench_direction', 'significant',
                        'model_from', 'model_to', 'model_pct', 'model_direction', 'concordant', 'relative_magnitude', 'within_bound', 'location']], 3))
m3 = pd.read_csv(R / 'm3_reflex_on_off.csv')
parts.append('# Table S6. Baroreflex on vs off\nThe reflex gain is a modeling assumption. 0 of 63 signs differ. Source: `results/m3_reflex_on_off.csv`.\n\n' + table(m3, 3))
bv = pd.read_csv(R / 'm2_iabp_balloon_volume.csv')
parts.append('# Table S7. IABP balloon volume on VA-ECMO 4 L/min (knob variant; not a recalibration)\n'
             'Donker 2019 used 30 mL with partial occlusion. Source: `results/m2_iabp_balloon_volume.csv`.\n\n'
             + table(bv[['arm', 'reflex', 'balloon_mL', 'd_lvedp', 'd_lvedv_pct', 'd_lap', 'd_nativeSv_pct']], 3))
img = base64.b64encode((R / 'figs' / 'v4_tornado.png').read_bytes()).decode()
parts.append('# Figure S1. One-at-a-time ±20% sensitivity\n' + demote(section(rep, '## V4.', '## V5.')) +
             f'\n\n<img src="data:image/png;base64,{img}" style="width:100%">\n')
shot = base64.b64encode((R / 'figs' / 'twin_pane_s3_s4.png').read_bytes()).decode()
parts.append('# Figure S2. Full screen of the paired-state display\n'
             'Released application (release/CardioFlow-MCS.html) in compare mode after settling: pane A, VA-ECMO 4 L/min; pane B, '
             'VA-ECMO 4 L/min + Impella P5. Captured by `paper/scripts/screenshot_twin.ts`; Figure 1B is a crop of the central B − A column.\n\n'
             f'<img src="data:image/png;base64,{shot}" style="width:100%">\n')
parts.append('# Video 1. Demonstration of the paired-state simulator\n'
             'Supplemental Digital Content Video 1 (SDC_Video_1.mp4; 4 min 55 s; also at https://youtu.be/sHLgmfZxZZM). Screen recording of the released '
             'application (release/CardioFlow-MCS.html, identical to the file at tag v1.0-asaio) driven by a scripted tour: cardiogenic shock without support; '
             'VA-ECMO 4 L/min in side-by-side compare mode; Impella, IABP and VA-ECMO with Impella; interior device views; and the built-in teaching session '
             'played with scripted demonstration answers (no human participant data). Captions and section titles were overlaid for the recording, and '
             'physiology segments are time-compressed 8x where marked. The video was produced for an earlier educational presentation of the tool and is '
             'provided for illustration; it is not part of the verification.\n')
parts.append('# Section S2. Parameter provenance\n' + demote(prov.split('\n', 1)[1]))
parts.append('# Section S3. Benchmark sources and extraction\n' + demote(section(rep, '## V3b.', '## V4.')))
md_all = '\n\n'.join(parts)
html_body = markdown.markdown(md_all, extensions=['tables', 'fenced_code'])
html = f"""<!doctype html><html><head><meta charset="utf-8"><title>SDC 1</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
 onload="renderMathInElement(document.body,{{delimiters:[{{left:'$$',right:'$$',display:true}},{{left:'$',right:'$',display:false}}]}});window.__katexDone=true"></script>
<style>body{{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.35;margin:0}}h1{{font-size:14pt;margin-top:18pt;page-break-before:always}}
h1:first-of-type{{page-break-before:avoid}}h2,h3,h4{{font-size:11pt}}table{{border-collapse:collapse;font-size:7.5pt;margin:6pt 0;width:100%}}
td,th{{border:0.5pt solid #999;padding:2pt 3pt;vertical-align:top}}th{{background:#eee}}code{{font-size:8pt}}</style></head><body>{html_body}</body></html>"""
(OUT / 'SDC1.html').write_text(html, encoding='utf8')
print('SDC1.html', len(html))
