/* SiliconPath Digital Logic Lab — deterministic, browser-only logic simulator. */
'use strict';
window.CircuitLab = (() => {
  const gates = {
    AND:  { expression: 'Y = A · B',      label: 'AND',  description: 'The output is 1 only when both inputs are 1.',                fn: (a,b) => a && b },
    OR:   { expression: 'Y = A + B',       label: 'OR',   description: 'The output is 1 when at least one input is 1.',               fn: (a,b) => a || b },
    NOT:  { expression: 'Y = ¬A',          label: 'NOT',  description: 'The output is the inverse of input A. This gate uses one input.', fn: a => !a },
    NAND: { expression: 'Y = ¬(A · B)',    label: 'NAND', description: 'The output is 0 only when both inputs are 1.',                fn: (a,b) => !(a && b) },
    NOR:  { expression: 'Y = ¬(A + B)',    label: 'NOR',  description: 'The output is 1 only when both inputs are 0.',               fn: (a,b) => !(a || b) },
    XOR:  { expression: 'Y = A ⊕ B',       label: 'XOR',  description: 'The output is 1 when the inputs differ.',                     fn: (a,b) => a !== b },
    XNOR: { expression: 'Y = ¬(A ⊕ B)',    label: 'XNOR', description: 'The output is 1 when the inputs are equal.',                   fn: (a,b) => a === b }
  };
  const state = { gate: 'AND', a: 0, b: 0 };
  const output = (gate, a, b = 0) => {
    if (!gates[gate]) throw new Error('Unknown logic gate: ' + gate);
    if (![0,1].includes(a) || ![0,1].includes(b)) throw new Error('Inputs must be binary values 0 or 1.');
    return Number(Boolean(gates[gate].fn(Boolean(a), Boolean(b))));
  };
  const truthTable = gate => {
    if (!gates[gate]) throw new Error('Unknown logic gate: ' + gate);
    return (gate === 'NOT' ? [0,1].map(a => ({a, b: null, y: output(gate,a,0)})) :
      [0,1].flatMap(a => [0,1].map(b => ({a,b,y:output(gate,a,b)}))));
  };
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function page() {
    const gate = gates[state.gate], y = output(state.gate,state.a,state.b);
    const rows = truthTable(state.gate).map(row => {
      const current = row.a === state.a && (row.b === null || row.b === state.b);
      return '<tr' + (current ? ' class="logic-current" aria-current="true"' : '') + '><td>' + row.a + '</td>' +
        (row.b === null ? '' : '<td>' + row.b + '</td>') + '<td><strong>' + row.y + '</strong></td></tr>';
    }).join('');
    const bControl = state.gate === 'NOT' ? '<p class="logic-help">NOT uses input A only; input B is not part of this gate.</p>' :
      '<div class="logic-input"><span>Input B</span><button class="logic-switch" data-logic-input="b" aria-pressed="' + Boolean(state.b) + '" aria-label="Set input B to ' + (state.b ? 'zero' : 'one') + '"><span>' + state.b + '</span></button></div>';
    return '<div class="wrap logic-wrap">' +
      '<div class="page-head"><div class="eyebrow">Interactive digital electronics</div><h1>Digital Circuit Lab</h1><p class="lead">Explore seven logic gates, change binary inputs, and see deterministic outputs and truth tables update instantly. This is a browser-based logic simulation—not a physical circuit measurement.</p></div>' +
      '<div class="logic-toolbar"><label for="logic-gate">Choose a logic gate</label><select id="logic-gate" data-logic-gate>' +
      Object.keys(gates).map(name => '<option value="' + name + '"' + (name === state.gate ? ' selected' : '') + '>' + name + ' gate</option>').join('') +
      '</select><button class="btn secondary" data-logic-reset>Reset inputs</button></div>' +
      '<div class="logic-layout"><section class="panel logic-board" aria-labelledby="logic-live-title"><div class="logic-panel-head"><div><span class="eyebrow">Live experiment</span><h2 id="logic-live-title">' + gate.label + ' gate</h2></div><span class="logic-sim-badge">SIMULATION</span></div>' +
      '<div class="logic-inputs"><div class="logic-input"><span>Input A</span><button class="logic-switch" data-logic-input="a" aria-pressed="' + Boolean(state.a) + '" aria-label="Set input A to ' + (state.a ? 'zero' : 'one') + '"><span>' + state.a + '</span></button></div>' + bControl + '</div>' +
      '<div class="logic-diagram"><svg viewBox="0 0 520 180" role="img" aria-labelledby="logic-svg-title logic-svg-desc"><title id="logic-svg-title">' + gate.label + ' gate schematic</title><desc id="logic-svg-desc">Binary input A is ' + state.a + (state.gate === 'NOT' ? '' : ' and input B is ' + state.b) + '. The simulated output is ' + y + '.</desc>' +
      '<path d="M24 48 H155 M24 132 H155 M275 90 H470" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      (state.gate === 'NOT' ? '<path d="M155 24 L155 156 L275 90 Z" fill="#e7efdb" stroke="#20594e" stroke-width="3"/><circle cx="286" cy="90" r="10" fill="#f7f8f2" stroke="#20594e" stroke-width="3"/>' :
      '<path d="M155 24 L210 24 Q320 24 320 90 Q320 156 210 156 L155 156 Z" fill="#e7efdb" stroke="#20594e" stroke-width="3"/>' +
      (state.gate === 'AND' || state.gate === 'NAND' ? '<path d="M155 24 H210 Q320 24 320 90 Q320 156 210 156 H155 Z" fill="#e7efdb" stroke="#20594e" stroke-width="3"/>' : '') +
      (state.gate === 'NAND' || state.gate === 'NOR' || state.gate === 'XNOR' ? '<circle cx="332" cy="90" r="10" fill="#f7f8f2" stroke="#20594e" stroke-width="3"/>' : '') ) +
      '<text x="34" y="38" fill="currentColor" font-size="13">A = ' + state.a + '</text>' +
      (state.gate === 'NOT' ? '' : '<text x="34" y="122" fill="currentColor" font-size="13">B = ' + state.b + '</text>') +
      '<text x="430" y="76" fill="currentColor" font-size="13">OUTPUT</text><circle cx="470" cy="90" r="20" fill="' + (y ? '#d5e9a9' : '#f2d5a0') + '" stroke="#20594e" stroke-width="3"/><text x="470" y="96" text-anchor="middle" fill="#193c38" font-size="17" font-weight="700">' + y + '</text>' +
      '<text x="225" y="95" text-anchor="middle" fill="#193c38" font-size="13" font-weight="700">' + gate.label + '</text></svg></div>' +
      '<div class="logic-result" aria-live="polite"><div><span>Current output</span><strong>' + y + '</strong></div><div><span>Boolean expression</span><code>' + esc(gate.expression) + '</code></div></div>' +
      '<p class="logic-explanation">' + esc(gate.description) + '</p><div class="logic-callout"><strong>Think like an engineer</strong><p>Change one input at a time. Predict the output first, then compare your prediction with the truth table. The highlighted row shows the current input combination.</p></div></section>' +
      '<section class="panel logic-table-panel" aria-labelledby="logic-table-title"><div class="eyebrow">Complete input combinations</div><h2 id="logic-table-title">Truth table</h2><table class="logic-table"><caption>' + gate.label + ' gate truth table; highlighted row matches the current inputs.</caption><thead><tr><th scope="col">A</th>' + (state.gate === 'NOT' ? '' : '<th scope="col">B</th>') + '<th scope="col">Y</th></tr></thead><tbody>' + rows + '</tbody></table><p class="logic-help">1 means HIGH / true. 0 means LOW / false. Real voltage levels depend on the selected logic family and hardware.</p><button class="btn secondary small" data-logic-reset>Reset to A = 0, B = 0</button></section></div>' +
      '<section class="logic-next"><div><span class="eyebrow">Next challenge</span><h2>Can you predict the output?</h2><p>Try XOR, then set A = 1 and B = 0. XOR is true when its two inputs differ. Compare it with XNOR, which is true when they match.</p></div><div class="logic-gate-chips">' + Object.keys(gates).map(name => '<button data-logic-select="' + name + '" aria-pressed="' + (state.gate === name) + '">' + name + '</button>').join('') + '</div></section>' +
      '<p class="subtle logic-disclaimer">Educational digital-logic model only. It does not model propagation delay, voltage thresholds, electrical loading, noise, or physical hardware behavior.</p></div>';
  }
  let bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', event => {
      const input = event.target.closest('[data-logic-input]');
      if (input) { const key = input.dataset.logicInput; state[key] = state[key] ? 0 : 1; redraw(); return; }
      const select = event.target.closest('[data-logic-select]');
      if (select) { state.gate = select.dataset.logicSelect; redraw(); return; }
      if (event.target.closest('[data-logic-reset]')) { state.a = 0; state.b = 0; redraw(); }
    });
    document.addEventListener('change', event => {
      if (event.target.matches('[data-logic-gate]')) { state.gate = event.target.value; redraw(); }
    });
  }
  function redraw() {
    const main = document.querySelector('#main');
    if (main && location.hash.slice(1).split('/')[0] === 'circuit') main.innerHTML = page();
  }
  return { gates, output, truthTable, page, bind, getState: () => ({...state}) };
})();
