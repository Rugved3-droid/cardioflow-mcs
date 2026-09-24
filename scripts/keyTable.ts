/**
 * Emits validation/ANSWER-KEYS.md — the answer-key sign-off table.
 * Generated from the item bank itself so it can never drift from what ships.
 */
import { writeFileSync } from 'node:fs';
import { ACTIVE_ITEMS, CONSTRUCT_LABEL, ITEM_BANK, RETIRED_ITEMS } from '../src/assessment/itemBank';

const esc = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const dirWord = (id: string, d: string) => {
  const i = ITEM_BANK.find((x) => x.id === id)!;
  return i.optionLabels ? i.optionLabels[d as 'rise' | 'fall' | 'unchanged'] : d.toUpperCase();
};

const md: string[] = [];
md.push('# Answer-key sign-off');
md.push('');
md.push('**For cardiologist review.** Every row is one item a resident is scored on. Generated from');
md.push('`src/assessment/itemBank.ts` by `npm run keytable` — this table and the shipped bank cannot diverge.');
md.push('');
md.push('The simulator never supplies these answers. They are keyed by hand here, and validation check E7');
md.push('fails the build if the simulator ever disagrees with a key.');
md.push('');
md.push(`**${ACTIVE_ITEMS.length} active items** (shown to learners and scored) · **${RETIRED_ITEMS.length} retired** (never shown, kept for the record).`);
md.push('');
md.push('Please mark each row **agree / disagree / reword** and return.');
md.push('');
md.push('## Active items');
md.push('');
md.push('| # | Intervention | Learner predicts | KEY | Mechanism marked correct | Status |');
md.push('|---|---|---|---|---|---|');
ACTIVE_ITEMS.forEach((i, n) => {
  md.push(
    `| ${n + 1} | ${esc(i.intervention)} | ${esc(i.variable)} | **${dirWord(i.id, i.correct)}** | ${esc(i.mechanism.options[i.mechanism.correctIndex])} | ${i.verification.startsWith('VERIFIED') ? 'VERIFIED' : 'REVIEW'} |`,
  );
});
md.push('');
md.push('## Basis for each key');
md.push('');
for (const i of ACTIVE_ITEMS) {
  md.push(`### ${i.id} — ${CONSTRUCT_LABEL[i.construct]}`);
  md.push('');
  md.push(`- **Stem:** ${i.intervention}. *${i.variable}* will: **${dirWord(i.id, i.correct)}**`);
  md.push(`- **Causal chain shown after reveal:** ${i.explanation}`);
  md.push(`- **Cited:** ${i.source}`);
  md.push(`- **Basis:** ${i.verification}`);
  md.push('');
}
if (RETIRED_ITEMS.length) {
  md.push('## Retired items (NOT shown to learners, NOT scored)');
  md.push('');
  for (const i of RETIRED_ITEMS) {
    md.push(`### ${i.id} — would have keyed **${dirWord(i.id, i.correct)}**`);
    md.push('');
    md.push(`- **Stem:** ${i.intervention}. *${i.variable}* will: ${dirWord(i.id, i.correct)}`);
    md.push(`- **Why retired:** ${i.verification}`);
    md.push('');
  }
}
md.push('## References');
md.push('');
md.push('All confirmed to exist with the journal, year, volume and pages below.');
md.push('');
md.push('- Burkhoff D, Sayer G, Doshi D, Uriel N. Hemodynamics of mechanical circulatory support. *J Am Coll Cardiol.* 2015;66(23):2663–74.');
md.push('- Rao P, Khalpey Z, Smith R, Burkhoff D, Kociol RD. Venoarterial extracorporeal membrane oxygenation for cardiogenic shock and cardiac arrest. *Circ Heart Fail.* 2018;11(9):e004905.');
md.push('- Ostadal P, Mlcek M, Kruger A, et al. Increasing venoarterial extracorporeal membrane oxygenation flow negatively affects left ventricular performance in a porcine model of cardiogenic shock. *J Transl Med.* 2015;13:266.');
md.push('- Donker DW, Brodie D, Henriques JPS, Broomé M. Left ventricular unloading during veno-arterial ECMO: a simulation study. *ASAIO J.* 2019;65(1):11–20.');
md.push('- Pappalardo F, Schulte C, Pieri M, et al. Concomitant implantation of Impella on top of veno-arterial ECMO may improve survival of patients with cardiogenic shock. *Eur J Heart Fail.* 2017;19(3):404–12. *(outcomes only — cited for clinical use, not for any hemodynamic direction)*');
md.push('- Ezad SM, Ryan M, Donker DW, et al. Unloading the left ventricle in venoarterial ECMO: in whom, when, and how? *Circulation.* 2023;147(16):1237–50.');
md.push('- Schrage B, Burkhoff D, Westermann D, et al. Unloading of the left ventricle during venoarterial extracorporeal membrane oxygenation therapy in cardiogenic shock. *JACC Heart Fail.* 2018;6(12):1035–43.');
md.push('- Trost JC, Hillis LD. Intra-aortic balloon counterpulsation. *Am J Cardiol.* 2006;97(9):1391–8.');
md.push('- Krishna M, Zacharowski K. Principles of intra-aortic balloon pump counterpulsation. *Contin Educ Anaesth Crit Care Pain.* 2009;9(1):24–8.');
md.push('');
writeFileSync('validation/ANSWER-KEYS.md', md.join('\n'));
console.log(`wrote validation/ANSWER-KEYS.md (${ACTIVE_ITEMS.length} active, ${RETIRED_ITEMS.length} retired)`);
