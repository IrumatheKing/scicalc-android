/**
 * Graph Engine — Canvas-based function plotter with pan/zoom
 */
class GraphEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // View bounds
    this.xMin = -10; this.xMax = 10;
    this.yMin = -10; this.yMax = 10;

    // Functions to plot [{expr, color, compiled}]
    this.functions = [];

    // Colors for multiple functions
    this.colors = [
      '#ff6b6b', '#6c5ce7', '#00cec9', '#fdcb6e',
      '#55efc4', '#fd79a8', '#74b9ff', '#e17055',
      '#a29bfe', '#81ecec'
    ];

    // Pan state
    this._panning = false;
    this._panStart = null;
    this._panViewStart = null;

    // Pinch zoom state
    this._pinchDist = null;
    this._pinchCenter = null;
    this._pinchViewStart = null;

    this._coordsEl = document.getElementById('graph-coords');
    this._xRangeEl = document.getElementById('graph-x-range');
    this._yRangeEl = document.getElementById('graph-y-range');

    this._setupListeners();
    this._resizeCanvas();

    window.addEventListener('resize', () => {
      this._resizeCanvas();
      this.draw();
    });
  }

  _resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
  }

  _setupListeners() {
    const c = this.canvas;

    // Mouse pan
    c.addEventListener('mousedown', e => this._startPan(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => {
      if (this._panning) this._doPan(e.clientX, e.clientY);
      this._showCoords(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => this._endPan());

    // Touch pan + pinch
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._startPan(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this._startPinch(e.touches);
      }
    }, { passive: false });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this._panning) {
        this._doPan(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this._doPinch(e.touches);
      }
    }, { passive: false });
    c.addEventListener('touchend', () => { this._endPan(); this._pinchDist = null; });

    // Mouse wheel zoom
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      this._zoomAt(mx, my, factor);
    }, { passive: false });
  }

  _startPan(cx, cy) {
    this._panning = true;
    this._panStart = { x: cx, y: cy };
    this._panViewStart = { xMin: this.xMin, xMax: this.xMax, yMin: this.yMin, yMax: this.yMax };
  }

  _doPan(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const dx = cx - this._panStart.x;
    const dy = cy - this._panStart.y;
    const xRange = this._panViewStart.xMax - this._panViewStart.xMin;
    const yRange = this._panViewStart.yMax - this._panViewStart.yMin;
    const sx = -dx / rect.width * xRange;
    const sy = dy / rect.height * yRange;
    this.xMin = this._panViewStart.xMin + sx;
    this.xMax = this._panViewStart.xMax + sx;
    this.yMin = this._panViewStart.yMin + sy;
    this.yMax = this._panViewStart.yMax + sy;
    this.draw();
    this._updateRangeDisplay();
  }

  _endPan() { this._panning = false; }

  _startPinch(touches) {
    this._panning = false;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    this._pinchDist = Math.sqrt(dx * dx + dy * dy);
    const rect = this.canvas.getBoundingClientRect();
    this._pinchCenter = {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
    this._pinchViewStart = { xMin: this.xMin, xMax: this.xMax, yMin: this.yMin, yMax: this.yMax };
  }

  _doPinch(touches) {
    if (!this._pinchDist) return;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = this._pinchDist / dist;
    this._zoomAtFromView(this._pinchCenter.x, this._pinchCenter.y, factor, this._pinchViewStart);
  }

  _zoomAt(mx, my, factor) {
    const xFrac = mx / this.W;
    const yFrac = my / this.H;
    const xRange = this.xMax - this.xMin;
    const yRange = this.yMax - this.yMin;
    const cx = this.xMin + xFrac * xRange;
    const cy = this.yMax - yFrac * yRange;
    const nxRange = xRange * factor;
    const nyRange = yRange * factor;
    // clamp to reasonable zoom
    if (nxRange < 0.0001 || nxRange > 1e8) return;
    this.xMin = cx - xFrac * nxRange;
    this.xMax = cx + (1 - xFrac) * nxRange;
    this.yMin = cy - (1 - yFrac) * nyRange;
    this.yMax = cy + yFrac * nyRange;
    this.draw();
    this._updateRangeDisplay();
  }

  _zoomAtFromView(mx, my, factor, view) {
    const xFrac = mx / this.W;
    const yFrac = my / this.H;
    const xRange = view.xMax - view.xMin;
    const yRange = view.yMax - view.yMin;
    const cx = view.xMin + xFrac * xRange;
    const cy = view.yMax - yFrac * yRange;
    const nxRange = xRange * factor;
    const nyRange = yRange * factor;
    if (nxRange < 0.0001 || nxRange > 1e8) return;
    this.xMin = cx - xFrac * nxRange;
    this.xMax = cx + (1 - xFrac) * nxRange;
    this.yMin = cy - (1 - yFrac) * nyRange;
    this.yMax = cy + yFrac * nyRange;
    this.draw();
    this._updateRangeDisplay();
  }

  _showCoords(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = cx - rect.left;
    const my = cy - rect.top;
    if (mx < 0 || mx > this.W || my < 0 || my > this.H) {
      this._coordsEl.classList.remove('visible');
      return;
    }
    const x = this.xMin + (mx / this.W) * (this.xMax - this.xMin);
    const y = this.yMax - (my / this.H) * (this.yMax - this.yMin);
    this._coordsEl.textContent = `(${x.toFixed(3)}, ${y.toFixed(3)})`;
    this._coordsEl.classList.add('visible');
  }

  _updateRangeDisplay() {
    if (this._xRangeEl) this._xRangeEl.textContent = `x: [${this.xMin.toFixed(2)}, ${this.xMax.toFixed(2)}]`;
    if (this._yRangeEl) this._yRangeEl.textContent = `y: [${this.yMin.toFixed(2)}, ${this.yMax.toFixed(2)}]`;
  }

  toScreenX(x) { return (x - this.xMin) / (this.xMax - this.xMin) * this.W; }
  toScreenY(y) { return (this.yMax - y) / (this.yMax - this.yMin) * this.H; }

  /**
   * Compile a math expression string into a JS function of x
   */
  compile(expr) {
    // Replace math functions and constants
    let s = expr
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\bsin\b/gi, 'Math.sin')
      .replace(/\bcos\b/gi, 'Math.cos')
      .replace(/\btan\b/gi, 'Math.tan')
      .replace(/\basin\b/gi, 'Math.asin')
      .replace(/\bacos\b/gi, 'Math.acos')
      .replace(/\batan\b/gi, 'Math.atan')
      .replace(/\bsinh\b/gi, 'Math.sinh')
      .replace(/\bcosh\b/gi, 'Math.cosh')
      .replace(/\btanh\b/gi, 'Math.tanh')
      .replace(/\bln\b/gi, 'Math.log')
      .replace(/\blog10\b/gi, 'Math.log10')
      .replace(/\blog2\b/gi, 'Math.log2')
      .replace(/\blog\b/gi, 'Math.log10')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\bcbrt\b/gi, 'Math.cbrt')
      .replace(/\babs\b/gi, 'Math.abs')
      .replace(/\bfloor\b/gi, 'Math.floor')
      .replace(/\bceil\b/gi, 'Math.ceil')
      .replace(/\bround\b/gi, 'Math.round')
      .replace(/\bsign\b/gi, 'Math.sign')
      .replace(/\bexp\b/gi, 'Math.exp')
      .replace(/\bpow\b/gi, 'Math.pow');
    // Support ^ as exponentiation
    s = s.replace(/\^/g, '**');
    // Implicit multiplication: 2x -> 2*x, x(... -> x*(, )(... -> )*(
    s = s.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
    s = s.replace(/\)(\()/g, ')*(');
    s = s.replace(/\)([a-zA-Z])/g, ')*$1');
    try {
      return new Function('x', `"use strict"; return (${s});`);
    } catch (e) {
      return null;
    }
  }

  setFunctions(fnExprs) {
    this.functions = fnExprs.map((expr, i) => ({
      expr,
      color: this.colors[i % this.colors.length],
      compiled: this.compile(expr)
    }));
  }

  draw() {
    this._resizeCanvas();
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // Background
    ctx.fillStyle = '#06061a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    this._drawGrid(ctx, W, H);

    // Draw each function
    for (const fn of this.functions) {
      if (!fn.compiled) continue;
      this._drawFunction(ctx, fn, W);
    }
  }

  _drawGrid(ctx, W, H) {
    const xRange = this.xMax - this.xMin;
    const yRange = this.yMax - this.yMin;

    // Calculate nice step
    const xStep = this._niceStep(xRange / 10);
    const yStep = this._niceStep(yRange / 10);

    ctx.lineWidth = 1;

    // Minor grid
    ctx.strokeStyle = 'rgba(108,92,231,0.07)';
    const xMinorStep = xStep / 5;
    const yMinorStep = yStep / 5;
    const xStart = Math.floor(this.xMin / xMinorStep) * xMinorStep;
    const yStart = Math.floor(this.yMin / yMinorStep) * yMinorStep;

    ctx.beginPath();
    for (let x = xStart; x <= this.xMax; x += xMinorStep) {
      const sx = this.toScreenX(x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let y = yStart; y <= this.yMax; y += yMinorStep) {
      const sy = this.toScreenY(y);
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = 'rgba(108,92,231,0.18)';
    const xMajStart = Math.floor(this.xMin / xStep) * xStep;
    const yMajStart = Math.floor(this.yMin / yStep) * yStep;
    ctx.beginPath();
    for (let x = xMajStart; x <= this.xMax; x += xStep) {
      const sx = this.toScreenX(x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let y = yMajStart; y <= this.yMax; y += yStep) {
      const sy = this.toScreenY(y);
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    const ox = this.toScreenX(0);
    const oy = this.toScreenY(0);
    ctx.beginPath();
    if (ox >= 0 && ox <= W) { ctx.moveTo(ox, 0); ctx.lineTo(ox, H); }
    if (oy >= 0 && oy <= H) { ctx.moveTo(0, oy); ctx.lineTo(W, oy); }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(157,157,204,0.6)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = xMajStart; x <= this.xMax; x += xStep) {
      if (Math.abs(x) < xStep * 0.01) continue;
      const sx = this.toScreenX(x);
      const label = this._formatNum(x);
      ctx.fillText(label, sx, oy + 4 > H - 14 ? H - 14 : Math.max(2, oy + 4));
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let y = yMajStart; y <= this.yMax; y += yStep) {
      if (Math.abs(y) < yStep * 0.01) continue;
      const sy = this.toScreenY(y);
      const label = this._formatNum(y);
      ctx.fillText(label, ox + 4 > W - 30 ? W - 30 : Math.max(2, ox + 4), sy);
    }
  }

  _drawFunction(ctx, fn, W) {
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Also draw a subtle glow
    ctx.shadowColor = fn.color;
    ctx.shadowBlur = 6;

    const steps = Math.max(W * 2, 500);
    const dx = (this.xMax - this.xMin) / steps;

    ctx.beginPath();
    let penDown = false;

    for (let i = 0; i <= steps; i++) {
      const x = this.xMin + i * dx;
      let y;
      try { y = fn.compiled(x); } catch { continue; }
      if (!isFinite(y) || isNaN(y)) { penDown = false; continue; }

      const sx = this.toScreenX(x);
      const sy = this.toScreenY(y);

      // Skip if wildly off screen (avoid huge paths)
      if (sy < -1000 || sy > this.H + 1000) { penDown = false; continue; }

      if (!penDown) {
        ctx.moveTo(sx, sy);
        penDown = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _niceStep(rough) {
    const p = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / p;
    if (n < 1.5) return p;
    if (n < 3.5) return 2 * p;
    if (n < 7.5) return 5 * p;
    return 10 * p;
  }

  _formatNum(n) {
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(1);
    const s = n.toPrecision(4);
    return parseFloat(s).toString();
  }

  zoomIn() {
    this._zoomAt(this.W / 2, this.H / 2, 1 / 1.4);
  }

  zoomOut() {
    this._zoomAt(this.W / 2, this.H / 2, 1.4);
  }

  resetView() {
    this.xMin = -10; this.xMax = 10;
    this.yMin = -10; this.yMax = 10;
    this.draw();
    this._updateRangeDisplay();
  }
}
