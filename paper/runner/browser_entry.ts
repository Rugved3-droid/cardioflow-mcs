// Bundled by esbuild into an IIFE and executed inside headless Chrome (V8 in the browser).
import { runEquivBattery } from './equiv_scenarios';
(globalThis as unknown as { __runEquiv: typeof runEquivBattery }).__runEquiv = runEquivBattery;
