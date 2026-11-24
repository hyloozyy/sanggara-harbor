// Analogue speedometer drawn on a canvas: arc gauge, ticks, needle, km/h readout, gear and a
// drift indicator.

export function drawSpeedometer(canvas, kmh, maxKmh, gear, drifting) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H - 14, r = 86;
  ctx.clearRect(0, 0, W, H);
  const a0 = Math.PI * 1.05, a1 = Math.PI * 1.95;
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  const t = Math.min(1, kmh / maxKmh);
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, '#3fd6c6'); g.addColorStop(0.6, '#ffc35a'); g.addColorStop(1, '#ff4b4b');
  ctx.strokeStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * t); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (a1 - a0) * (i / 10);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); ctx.stroke();
  }
  const na = a0 + (a1 - a0) * t;
  ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (r - 14), cy + Math.sin(na) * (r - 14)); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(Math.round(kmh)), cx, cy - 18);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('KM/H', cx, cy - 4);
  ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#ffc35a';
  ctx.fillText(gear, cx + r - 6, cy - 2);
  if (drifting) { ctx.fillStyle = '#3fd6c6'; ctx.fillText('DRIFT!', cx - r + 14, cy - 2); }
}
