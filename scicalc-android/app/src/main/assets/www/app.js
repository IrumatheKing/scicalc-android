/**
 * SciCalc Pro — Main Application Logic
 * Scientific, Graphing, Programmer, and Programmable Modes
 */
(() => {
  'use strict';

  // ==================== SERVICE WORKER ====================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // ==================== MODE SWITCHING ====================
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.mode-panel');
  let currentMode = 'scientific';
  let graphEngine = null;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode === currentMode) return;
      currentMode = mode;
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById('mode-' + mode).classList.add('active');

      if (mode === 'graphing' && !graphEngine) {
        graphEngine = new GraphEngine('graph-canvas');
        plotGraphFunctions();
      } else if (mode === 'graphing') {
        setTimeout(() => graphEngine.draw(), 50);
      }
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  // ==================== SCIENTIFIC CALCULATOR ====================
  const sciExpression = document.getElementById('sci-expression');
  const sciResult = document.getElementById('sci-result');
  const sciHistory = document.getElementById('sci-history');
  const angleToggle = document.getElementById('angle-toggle');
  const memIndicator = document.getElementById('memory-indicator');

  let expression = '';
  let lastResult = '0';
  let isNewCalculation = false;
  let angleMode = 'DEG'; // DEG or RAD
  let memory = 0;
  let isSecond = false;

  // Second function mappings
  const secondMap = {
    'sin': 'asin', 'cos': 'acos', 'tan': 'atan',
    'ln': 'log₂', 'log': 'ln',
    'x²': 'x⁻²', 'x³': 'x⁻³',
    '√': '∛', 'eˣ': '2ˣ', '10ˣ': 'eˣ'
  };

  angleToggle.addEventListener('click', () => {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    angleToggle.textContent = angleMode;
    if (navigator.vibrate) navigator.vibrate(10);
  });

  // Attach button handlers for Scientific mode
  document.querySelector('.sci-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const action = btn.dataset.action;
    handleSciAction(action);
    if (navigator.vibrate) navigator.vibrate(8);
  });

  function handleSciAction(action) {
    if (isNewCalculation && !isNaN(action) && action !== '.') {
      expression = '';
      isNewCalculation = false;
    }

    switch (action) {
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        if (isNewCalculation) { expression = ''; isNewCalculation = false; }
        expression += action;
        break;
      case '.':
        if (isNewCalculation) { expression = '0'; isNewCalculation = false; }
        // Prevent multiple dots in current number
        const parts = expression.split(/[+\-×÷(]/);
        const last = parts[parts.length - 1];
        if (!last.includes('.')) expression += '.';
        break;
      case '+': case '-': case '×': case '÷':
        isNewCalculation = false;
        expression += ' ' + action + ' ';
        break;
      case '=':
        calculateScientific();
        return;
      case 'clear':
        expression = '';
        lastResult = '0';
        sciHistory.textContent = '';
        sciResult.textContent = '0';
        sciExpression.textContent = '';
        isNewCalculation = false;
        return;
      case 'backspace':
        if (expression.endsWith(' ')) expression = expression.slice(0, -3);
        else expression = expression.slice(0, -1);
        break;
      case '±':
        expression = toggleSign(expression);
        break;
      case '%':
        expression += '/100';
        break;
      case '(': case ')':
        expression += action;
        break;
      case 'pi': expression += 'π'; break;
      case 'e': expression += 'e'; break;
      case 'x²': expression = `(${expression || lastResult})²`; break;
      case 'x³': expression = `(${expression || lastResult})³`; break;
      case 'xⁿ': expression = `(${expression || lastResult})^`; break;
      case 'eˣ': expression = `e^(${expression || lastResult})`; break;
      case '10ˣ': expression = `10^(${expression || lastResult})`; break;
      case '1/x': expression = `1/(${expression || lastResult})`; break;
      case '√': expression = `√(${expression || lastResult})`; break;
      case '³√': expression = `³√(${expression || lastResult})`; break;
      case 'ⁿ√': expression = `(${expression || lastResult})^(1/`; break;
      case 'ln': expression = `ln(${expression || lastResult})`; break;
      case 'log': expression = `log(${expression || lastResult})`; break;
      case 'sin':
        expression = isSecond ? `asin(${expression || lastResult})` : `sin(${expression || lastResult})`;
        break;
      case 'cos':
        expression = isSecond ? `acos(${expression || lastResult})` : `cos(${expression || lastResult})`;
        break;
      case 'tan':
        expression = isSecond ? `atan(${expression || lastResult})` : `tan(${expression || lastResult})`;
        break;
      case 'n!': expression = `(${expression || lastResult})!`; break;
      case 'abs': expression = `|${expression || lastResult}|`; break;
      case 'second':
        isSecond = !isSecond;
        document.querySelectorAll('.sci-buttons .btn[data-action="second"]').forEach(b => {
          b.classList.toggle('second-active', isSecond);
        });
        updateSecondLabels();
        return;
      case 'MC': memory = 0; memIndicator.classList.add('hidden'); return;
      case 'MR':
        expression += memory.toString();
        break;
      case 'M+':
        memory += parseFloat(lastResult) || 0;
        memIndicator.classList.remove('hidden');
        return;
      case 'M-':
        memory -= parseFloat(lastResult) || 0;
        memIndicator.classList.remove('hidden');
        return;
    }

    sciExpression.textContent = expression;
    sciExpression.scrollLeft = sciExpression.scrollWidth;

    // Live preview
    try {
      const preview = evaluateExpression(expression);
      if (isFinite(preview) && !isNaN(preview)) {
        sciResult.textContent = formatNumber(preview);
      }
    } catch {}
  }

  function updateSecondLabels() {
    const btnMap = {
      'sin': ['sin', 'sin⁻¹'], 'cos': ['cos', 'cos⁻¹'], 'tan': ['tan', 'tan⁻¹'],
    };
    for (const [action, [normal, second]] of Object.entries(btnMap)) {
      const btn = document.querySelector(`.sci-buttons .btn[data-action="${action}"]`);
      if (btn) btn.textContent = isSecond ? second : normal;
    }
  }

  function calculateScientific() {
    if (!expression.trim()) return;
    try {
      const result = evaluateExpression(expression);
      if (!isFinite(result) && !isNaN(result)) {
        sciResult.textContent = result > 0 ? '∞' : '-∞';
      } else if (isNaN(result)) {
        sciResult.textContent = 'Error';
      } else {
        lastResult = formatNumber(result);
        sciHistory.textContent = expression + ' =';
        sciResult.textContent = lastResult;
        expression = lastResult;
        isNewCalculation = true;
      }
    } catch (e) {
      sciResult.textContent = 'Error';
    }
    sciExpression.textContent = expression;
  }

  function evaluateExpression(expr) {
    let s = expr;
    // Replace display symbols with JS math
    s = s.replace(/π/g, 'Math.PI');
    s = s.replace(/(?<![a-zA-Z])e(?![a-zA-Z^])/g, 'Math.E');
    s = s.replace(/×/g, '*');
    s = s.replace(/÷/g, '/');
    s = s.replace(/−/g, '-');

    // Handle factorial
    s = s.replace(/\(([^)]+)\)!/g, (_, inner) => `__fact(${inner})`);
    s = s.replace(/(\d+)!/g, (_, n) => `__fact(${n})`);

    // Handle absolute value |x|
    s = s.replace(/\|([^|]+)\|/g, 'Math.abs($1)');

    // Handle superscript powers
    s = s.replace(/²/g, '**2');
    s = s.replace(/³/g, '**3');
    s = s.replace(/⁻²/g, '**(-2)');
    s = s.replace(/⁻³/g, '**(-3)');

    // Handle roots
    s = s.replace(/³√\(([^)]+)\)/g, 'Math.cbrt($1)');
    s = s.replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)');

    // Handle trig with angle conversion
    if (angleMode === 'DEG') {
      s = s.replace(/\basin\(([^)]+)\)/g, 'Math.sin(($1)*Math.PI/180)');
      s = s.replace(/\bcos\(([^)]+)\)/g, 'Math.cos(($1)*Math.PI/180)');
      s = s.replace(/\btan\(([^)]+)\)/g, 'Math.tan(($1)*Math.PI/180)');
      s = s.replace(/\basin\(([^)]+)\)/g, 'Math.asin($1)*180/Math.PI');
      s = s.replace(/\bacos\(([^)]+)\)/g, 'Math.acos($1)*180/Math.PI');
      s = s.replace(/\batan\(([^)]+)\)/g, 'Math.atan($1)*180/Math.PI');
    } else {
      s = s.replace(/\basin\(/g, 'Math.asin(');
      s = s.replace(/\bacos\(/g, 'Math.acos(');
      s = s.replace(/\batan\(/g, 'Math.atan(');
      s = s.replace(/\bsin\(/g, 'Math.sin(');
      s = s.replace(/\bcos\(/g, 'Math.cos(');
      s = s.replace(/\btan\(/g, 'Math.tan(');
    }

    s = s.replace(/\bln\(/g, 'Math.log(');
    s = s.replace(/\blog₂\(/g, 'Math.log2(');
    s = s.replace(/\blog\(/g, 'Math.log10(');

    // Implicit multiplication
    s = s.replace(/(\d)(Math\.|__)/g, '$1*$2');
    s = s.replace(/(\d)\(/g, '$1*(');
    s = s.replace(/\)(\d)/g, ')*$1');
    s = s.replace(/\)\(/g, ')*(');

    // Factorial function
    const __fact = n => {
      n = Math.round(n);
      if (n < 0) return NaN;
      if (n <= 1) return 1;
      if (n > 170) return Infinity;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    };

    return new Function('__fact', `"use strict"; return (${s});`)(__fact);
  }

  function toggleSign(expr) {
    if (!expr) return '-';
    // Find last number and negate it
    const match = expr.match(/(.*?)(-?\d+\.?\d*)$/);
    if (match) {
      const prefix = match[1];
      const num = match[2];
      if (num.startsWith('-')) return prefix + num.slice(1);
      else return prefix + '-' + num;
    }
    return '-(' + expr + ')';
  }

  function formatNumber(n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
    if (Math.abs(n) > 1e15 || (Math.abs(n) < 1e-10 && n !== 0)) return n.toExponential(8);
    const s = n.toPrecision(12);
    return parseFloat(s).toString();
  }


  // ==================== GRAPHING MODE ====================
  const graphFnList = document.getElementById('graph-fn-list');
  const graphAddBtn = document.getElementById('graph-add-fn');
  const graphPlotBtn = document.getElementById('graph-plot');
  const graphZoomIn = document.getElementById('graph-zoom-in');
  const graphZoomOut = document.getElementById('graph-zoom-out');
  const graphReset = document.getElementById('graph-reset');

  const graphColors = ['#ff6b6b', '#6c5ce7', '#00cec9', '#fdcb6e', '#55efc4', '#fd79a8', '#74b9ff', '#e17055'];
  let graphFnCount = 1;

  graphAddBtn.addEventListener('click', () => {
    if (graphFnCount >= 8) return;
    const row = document.createElement('div');
    row.className = 'fn-input-row';
    row.dataset.index = graphFnCount;
    row.innerHTML = `
      <span class="fn-color" style="background:${graphColors[graphFnCount % graphColors.length]};"></span>
      <label>y =</label>
      <input type="text" class="graph-fn-input" placeholder="e.g. x^2" data-index="${graphFnCount}" id="graph-fn-${graphFnCount}">
      <button class="fn-remove-btn" data-index="${graphFnCount}" title="Remove">✕</button>
    `;
    graphFnList.appendChild(row);
    graphFnCount++;
  });

  graphFnList.addEventListener('click', e => {
    if (e.target.classList.contains('fn-remove-btn')) {
      const row = e.target.closest('.fn-input-row');
      if (graphFnList.children.length > 1) {
        row.remove();
        plotGraphFunctions();
      }
    }
  });

  // Plot on Enter key
  graphFnList.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      plotGraphFunctions();
    }
  });

  graphPlotBtn.addEventListener('click', () => plotGraphFunctions());
  graphZoomIn.addEventListener('click', () => { if (graphEngine) graphEngine.zoomIn(); });
  graphZoomOut.addEventListener('click', () => { if (graphEngine) graphEngine.zoomOut(); });
  graphReset.addEventListener('click', () => { if (graphEngine) graphEngine.resetView(); });

  function plotGraphFunctions() {
    if (!graphEngine) return;
    const inputs = document.querySelectorAll('.graph-fn-input');
    const exprs = [];
    inputs.forEach(inp => {
      const v = inp.value.trim();
      if (v) exprs.push(v);
    });
    graphEngine.setFunctions(exprs);
    graphEngine.draw();
  }


  // ==================== PROGRAMMER MODE ====================
  const progExpression = document.getElementById('prog-expression');
  const progResult = document.getElementById('prog-result');
  const progHex = document.getElementById('prog-hex');
  const progDec = document.getElementById('prog-dec');
  const progOct = document.getElementById('prog-oct');
  const progBin = document.getElementById('prog-bin');

  let progExpr = '';
  let progBase = 'DEC'; // HEX, DEC, OCT, BIN
  let progBits = 32;
  let progValue = 0;

  // Base selector
  document.querySelector('.prog-base-selector').addEventListener('click', e => {
    const btn = e.target.closest('.base-btn');
    if (!btn) return;

    if (btn.dataset.base) {
      progBase = btn.dataset.base;
      document.querySelectorAll('.base-btn[data-base]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateProgBaseDisplay();
      updateHexButtons();
      updateProgDigitButtons();
    }
    if (btn.dataset.bits) {
      progBits = parseInt(btn.dataset.bits);
      document.querySelectorAll('.base-btn[data-bits]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateProgAllBases();
    }
    if (navigator.vibrate) navigator.vibrate(10);
  });

  // Programmer buttons
  document.querySelector('.prog-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    handleProgAction(btn.dataset.action);
    if (navigator.vibrate) navigator.vibrate(8);
  });

  function handleProgAction(action) {
    switch (action) {
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
      case 'A': case 'B': case 'C': case 'D': case 'E': case 'F':
        progExpr += action;
        break;
      case '00':
        progExpr += '00';
        break;
      case '+': case '-': case '×': case '÷':
        progExpr += ' ' + action + ' ';
        break;
      case 'AND': progExpr += ' AND '; break;
      case 'OR': progExpr += ' OR '; break;
      case 'XOR': progExpr += ' XOR '; break;
      case 'NOT':
        progExpr = 'NOT(' + progExpr + ')';
        break;
      case '<<': progExpr += ' << '; break;
      case '>>': progExpr += ' >> '; break;
      case 'MOD': progExpr += ' MOD '; break;
      case '±': progExpr = toggleSign(progExpr); break;
      case 'clear':
        progExpr = '';
        progValue = 0;
        progResult.textContent = '0';
        progExpression.textContent = '';
        updateProgAllBases();
        return;
      case 'backspace':
        if (progExpr.endsWith(' ')) progExpr = progExpr.slice(0, -1).trimEnd();
        else progExpr = progExpr.slice(0, -1);
        break;
      case '=':
        calculateProgrammer();
        return;
    }

    progExpression.textContent = progExpr;
    progExpression.scrollLeft = progExpression.scrollWidth;

    // Live preview
    try {
      const val = evaluateProgExpression(progExpr);
      if (isFinite(val)) {
        progValue = Math.trunc(val);
        progResult.textContent = formatProgValue(progValue);
        updateProgAllBases();
      }
    } catch {}
  }

  function calculateProgrammer() {
    if (!progExpr.trim()) return;
    try {
      const val = evaluateProgExpression(progExpr);
      progValue = maskBits(Math.trunc(val));
      progResult.textContent = formatProgValue(progValue);
      progExpr = formatProgValue(progValue);
      progExpression.textContent = progExpr;
      updateProgAllBases();
    } catch {
      progResult.textContent = 'Error';
    }
  }

  function evaluateProgExpression(expr) {
    let s = expr;
    // Parse numbers based on current base
    s = s.replace(/\bNOT\(([^)]+)\)/g, (_, inner) => {
      const v = evaluateProgExpression(inner);
      return (~Math.trunc(v)).toString();
    });
    s = s.replace(/\bAND\b/g, '&');
    s = s.replace(/\bOR\b/g, '|');
    s = s.replace(/\bXOR\b/g, '^');
    s = s.replace(/\bMOD\b/g, '%');
    s = s.replace(/×/g, '*');
    s = s.replace(/÷/g, '/');
    s = s.replace(/−/g, '-');

    // Convert from current base
    if (progBase === 'HEX') {
      s = s.replace(/\b([0-9A-Fa-f]+)\b/g, (m) => {
        if (/^[0-9A-Fa-f]+$/.test(m)) return '0x' + m;
        return m;
      });
    } else if (progBase === 'OCT') {
      s = s.replace(/\b([0-7]+)\b/g, (m) => {
        if (/^[0-7]+$/.test(m)) return '0o' + m;
        return m;
      });
    } else if (progBase === 'BIN') {
      s = s.replace(/\b([01]+)\b/g, (m) => {
        if (/^[01]+$/.test(m)) return '0b' + m;
        return m;
      });
    }

    return new Function(`"use strict"; return (${s});`)();
  }

  function maskBits(val) {
    if (progBits === 8) return val & 0xFF;
    if (progBits === 32) return val | 0; // 32-bit signed
    if (progBits === 64) return val; // JS precision limit
    return val;
  }

  function formatProgValue(val) {
    val = Math.trunc(val);
    if (progBase === 'HEX') return val.toString(16).toUpperCase();
    if (progBase === 'OCT') return val.toString(8);
    if (progBase === 'BIN') return val.toString(2);
    return val.toString(10);
  }

  function updateProgAllBases() {
    const v = progValue;
    progHex.textContent = Math.trunc(v).toString(16).toUpperCase();
    progDec.textContent = Math.trunc(v).toString(10);
    progOct.textContent = Math.trunc(v).toString(8);

    // Format binary with spaces every 4 bits
    let binStr = (v >>> 0).toString(2);
    while (binStr.length % 4 !== 0) binStr = '0' + binStr;
    progBin.textContent = binStr.replace(/(.{4})/g, '$1 ').trim();

    // Highlight active base
    document.querySelectorAll('.base-value').forEach(el => el.classList.remove('active-base'));
    const activeId = 'prog-' + progBase.toLowerCase();
    const activeEl = document.getElementById(activeId);
    if (activeEl) activeEl.classList.add('active-base');
  }

  function updateHexButtons() {
    const hexBtns = document.querySelectorAll('.prog-hex-btn');
    hexBtns.forEach(btn => {
      btn.disabled = (progBase !== 'HEX');
    });
  }

  function updateProgDigitButtons() {
    const progBtns = document.querySelectorAll('.prog-buttons .btn.num');
    progBtns.forEach(btn => {
      const d = parseInt(btn.dataset.action);
      if (isNaN(d)) return;
      if (progBase === 'BIN') btn.disabled = d > 1;
      else if (progBase === 'OCT') btn.disabled = d > 7;
      else btn.disabled = false;
    });
  }

  function updateProgBaseDisplay() {
    progExpr = '';
    if (progValue !== 0) {
      progExpr = formatProgValue(progValue);
    }
    progExpression.textContent = progExpr;
    progResult.textContent = progExpr || '0';
  }

  // Initialize
  updateHexButtons();
  updateProgDigitButtons();


  // ==================== PROGRAMMABLE MODE ====================
  const progEditor = document.getElementById('prog-editor');
  const progOutput = document.getElementById('prog-output');
  const progRunBtn = document.getElementById('prog-run');
  const progClearOutput = document.getElementById('prog-clear-output');
  const progExamples = document.getElementById('prog-examples');
  const progSaveBtn = document.getElementById('prog-save');
  const progSavedList = document.getElementById('prog-saved-list');
  const progInputArea = document.getElementById('prog-input-area');
  const progInputField = document.getElementById('prog-input-field');
  const progInputSubmit = document.getElementById('prog-input-submit');
  const progInputLabel = document.getElementById('prog-input-label');

  // Example programs
  const examples = {
    quadratic: `// Quadratic Equation Solver: ax² + bx + c = 0
const a = await input("Enter a:");
const b = await input("Enter b:");
const c = await input("Enter c:");

const discriminant = b*b - 4*a*c;
output("Equation: " + a + "x² + " + b + "x + " + c + " = 0", "info");
output("Discriminant (Δ) = " + discriminant);

if (discriminant > 0) {
  const x1 = (-b + Math.sqrt(discriminant)) / (2*a);
  const x2 = (-b - Math.sqrt(discriminant)) / (2*a);
  output("Two real roots:", "info");
  output("  x₁ = " + x1.toFixed(6), "result");
  output("  x₂ = " + x2.toFixed(6), "result");
} else if (discriminant === 0) {
  const x = -b / (2*a);
  output("One repeated root:", "info");
  output("  x = " + x.toFixed(6), "result");
} else {
  const real = (-b / (2*a)).toFixed(6);
  const imag = (Math.sqrt(-discriminant) / (2*a)).toFixed(6);
  output("Two complex roots:", "info");
  output("  x₁ = " + real + " + " + imag + "i", "result");
  output("  x₂ = " + real + " - " + imag + "i", "result");
}`,
    fibonacci: `// Fibonacci Sequence Generator
const n = await input("How many terms?");
const count = parseInt(n);

if (count < 1 || isNaN(count)) {
  output("Please enter a positive integer", "error");
} else {
  output("Fibonacci sequence (" + count + " terms):", "info");
  let a = 0, b = 1;
  const seq = [];
  for (let i = 0; i < count; i++) {
    seq.push(a);
    [a, b] = [b, a + b];
  }
  output(seq.join(", "), "result");
  output("\\nSum: " + seq.reduce((s, v) => s + v, 0), "info");
  output("Golden ratio approx: " + (seq[seq.length-1] / seq[seq.length-2]).toFixed(10), "result");
}`,
    statistics: `// Statistics Calculator (Mean, Median, Std Dev)
const data = await input("Enter numbers (comma-separated):");
const nums = data.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

if (nums.length === 0) {
  output("No valid numbers provided", "error");
} else {
  output("Dataset: [" + nums.join(", ") + "]", "info");
  output("Count: " + nums.length);

  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / nums.length;
  output("Sum: " + sum.toFixed(4), "result");
  output("Mean: " + mean.toFixed(4), "result");

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  output("Median: " + median.toFixed(4), "result");

  output("Min: " + Math.min(...nums).toFixed(4));
  output("Max: " + Math.max(...nums).toFixed(4));
  output("Range: " + (Math.max(...nums) - Math.min(...nums)).toFixed(4));

  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length;
  output("Variance (σ²): " + variance.toFixed(4), "result");
  output("Std Dev (σ):   " + Math.sqrt(variance).toFixed(4), "result");

  const sampleVar = nums.length > 1 ?
    nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1) : 0;
  output("Sample Variance (s²): " + sampleVar.toFixed(4));
  output("Sample Std Dev (s):   " + Math.sqrt(sampleVar).toFixed(4));
}`,
    matrix2x2: `// 2×2 Matrix Operations
output("=== 2×2 Matrix Calculator ===", "info");
output("Enter Matrix A:", "info");
const a11 = parseFloat(await input("A[1,1]:"));
const a12 = parseFloat(await input("A[1,2]:"));
const a21 = parseFloat(await input("A[2,1]:"));
const a22 = parseFloat(await input("A[2,2]:"));

output("\\nMatrix A:", "info");
output("  | " + a11 + "  " + a12 + " |");
output("  | " + a21 + "  " + a22 + " |");

const det = a11 * a22 - a12 * a21;
output("\\nDeterminant: " + det.toFixed(4), "result");
output("Trace: " + (a11 + a22).toFixed(4), "result");

if (det !== 0) {
  output("\\nInverse:", "info");
  output("  | " + (a22/det).toFixed(4) + "  " + (-a12/det).toFixed(4) + " |", "result");
  output("  | " + (-a21/det).toFixed(4) + "  " + (a11/det).toFixed(4) + " |", "result");
} else {
  output("\\nMatrix is singular (no inverse)", "error");
}

// Eigenvalues
const tr = a11 + a22;
const disc = tr * tr - 4 * det;
output("\\nEigenvalues:", "info");
if (disc >= 0) {
  output("  λ₁ = " + ((tr + Math.sqrt(disc)) / 2).toFixed(4), "result");
  output("  λ₂ = " + ((tr - Math.sqrt(disc)) / 2).toFixed(4), "result");
} else {
  const re = (tr / 2).toFixed(4);
  const im = (Math.sqrt(-disc) / 2).toFixed(4);
  output("  λ₁ = " + re + " + " + im + "i", "result");
  output("  λ₂ = " + re + " - " + im + "i", "result");
}`,
    converter: `// Unit Converter
output("=== Unit Converter ===", "info");
output("Categories: length, weight, temperature", "info");
const cat = (await input("Category (length/weight/temperature):")).toLowerCase();

if (cat === "length") {
  const val = parseFloat(await input("Enter value in meters:"));
  output(val + " meters =", "info");
  output("  " + (val * 100).toFixed(4) + " centimeters", "result");
  output("  " + (val / 1000).toFixed(6) + " kilometers", "result");
  output("  " + (val * 3.28084).toFixed(4) + " feet", "result");
  output("  " + (val * 39.3701).toFixed(4) + " inches", "result");
  output("  " + (val * 1.09361).toFixed(4) + " yards", "result");
  output("  " + (val / 1609.344).toFixed(6) + " miles", "result");
} else if (cat === "weight") {
  const val = parseFloat(await input("Enter value in kilograms:"));
  output(val + " kilograms =", "info");
  output("  " + (val * 1000).toFixed(4) + " grams", "result");
  output("  " + (val * 2.20462).toFixed(4) + " pounds", "result");
  output("  " + (val * 35.274).toFixed(4) + " ounces", "result");
  output("  " + (val / 1000).toFixed(6) + " metric tons", "result");
} else if (cat === "temperature") {
  const val = parseFloat(await input("Enter value in Celsius:"));
  output(val + "°C =", "info");
  output("  " + (val * 9/5 + 32).toFixed(2) + "°F", "result");
  output("  " + (val + 273.15).toFixed(2) + " K", "result");
  output("  " + ((val + 273.15) * 9/5).toFixed(2) + "°R", "result");
} else {
  output("Unknown category: " + cat, "error");
}`,
    prime: `// Prime Number Checker & Factorizer
const n = parseInt(await input("Enter a positive integer:"));

if (isNaN(n) || n < 1) {
  output("Please enter a valid positive integer", "error");
} else {
  output("Analyzing " + n + "...", "info");

  // Primality test
  function isPrime(num) {
    if (num < 2) return false;
    if (num < 4) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;
    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
  }

  if (isPrime(n)) {
    output("✓ " + n + " is PRIME", "result");
  } else {
    output("✗ " + n + " is NOT prime", "error");

    // Prime factorization
    let num = n;
    const factors = [];
    for (let d = 2; d * d <= num; d++) {
      while (num % d === 0) {
        factors.push(d);
        num /= d;
      }
    }
    if (num > 1) factors.push(num);
    output("Prime factorization: " + factors.join(" × "), "result");

    // All divisors
    const divs = [];
    for (let i = 1; i <= n; i++) {
      if (n % i === 0) divs.push(i);
    }
    output("Divisors (" + divs.length + "): " + divs.join(", "), "info");
  }

  // Find nearby primes
  let prev = n - 1, next = n + 1;
  while (prev > 1 && !isPrime(prev)) prev--;
  while (!isPrime(next)) next++;
  output("\\nNearest primes:", "info");
  output("  Previous: " + prev, "result");
  output("  Next: " + next, "result");
}`
  };

  // Load examples
  progExamples.addEventListener('change', () => {
    const key = progExamples.value;
    if (key && examples[key]) {
      progEditor.value = examples[key];
    }
    progExamples.value = '';
  });

  // Clear output
  progClearOutput.addEventListener('click', () => {
    progOutput.innerHTML = '<span class="output-placeholder">Output will appear here...</span>';
  });

  // Save/Load
  progSaveBtn.addEventListener('click', () => {
    const code = progEditor.value.trim();
    if (!code) return;
    const name = prompt('Save as:');
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('scicalc_programs') || '{}');
    saved[name] = code;
    localStorage.setItem('scicalc_programs', JSON.stringify(saved));
    updateSavedList();
  });

  function updateSavedList() {
    const saved = JSON.parse(localStorage.getItem('scicalc_programs') || '{}');
    progSavedList.innerHTML = '<option value="">Load Saved...</option>';
    for (const name of Object.keys(saved)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      progSavedList.appendChild(opt);
    }
  }

  progSavedList.addEventListener('change', () => {
    const name = progSavedList.value;
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('scicalc_programs') || '{}');
    if (saved[name]) progEditor.value = saved[name];
    progSavedList.value = '';
  });

  updateSavedList();

  // Run program
  progRunBtn.addEventListener('click', () => runProgram());

  let inputResolve = null;

  function output(text, type = '') {
    const placeholder = progOutput.querySelector('.output-placeholder');
    if (placeholder) placeholder.remove();
    const line = document.createElement('div');
    line.className = 'output-line' + (type ? ' ' + type : '');
    line.textContent = text;
    progOutput.appendChild(line);
    progOutput.scrollTop = progOutput.scrollHeight;
  }

  function input(promptText) {
    return new Promise(resolve => {
      inputResolve = resolve;
      progInputLabel.textContent = promptText || 'Input:';
      progInputArea.classList.remove('hidden');
      progInputField.value = '';
      progInputField.focus();
    });
  }

  progInputSubmit.addEventListener('click', submitInput);
  progInputField.addEventListener('keydown', e => { if (e.key === 'Enter') submitInput(); });

  function submitInput() {
    if (inputResolve) {
      const val = progInputField.value;
      output('→ ' + val, 'info');
      progInputArea.classList.add('hidden');
      const res = inputResolve;
      inputResolve = null;
      // Try to parse as number if possible
      const num = parseFloat(val);
      res(isNaN(num) ? val : num);
    }
  }

  async function runProgram() {
    const code = progEditor.value;
    if (!code.trim()) return;

    progOutput.innerHTML = '';
    output('▶ Running...', 'info');

    try {
      // Create an async function with output and input available
      const fn = new Function('output', 'input', `
        return (async () => {
          ${code}
        })();
      `);
      await fn(output, input);
      output('✓ Done', 'info');
    } catch (e) {
      output('Error: ' + e.message, 'error');
    }
  }

  // Handle Tab key in editor
  progEditor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = progEditor.selectionStart;
      const end = progEditor.selectionEnd;
      progEditor.value = progEditor.value.substring(0, start) + '  ' + progEditor.value.substring(end);
      progEditor.selectionStart = progEditor.selectionEnd = start + 2;
    }
  });

  // ==================== KEYBOARD SHORTCUTS ====================
  document.addEventListener('keydown', e => {
    if (currentMode !== 'scientific') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;
    if (/^[0-9]$/.test(key)) handleSciAction(key);
    else if (key === '.') handleSciAction('.');
    else if (key === '+') handleSciAction('+');
    else if (key === '-') handleSciAction('-');
    else if (key === '*') handleSciAction('×');
    else if (key === '/') { e.preventDefault(); handleSciAction('÷'); }
    else if (key === 'Enter' || key === '=') handleSciAction('=');
    else if (key === 'Backspace') handleSciAction('backspace');
    else if (key === 'Escape') handleSciAction('clear');
    else if (key === '(') handleSciAction('(');
    else if (key === ')') handleSciAction(')');
    else if (key === '%') handleSciAction('%');
  });

})();
