/* ---------------- 描画: 図形ヘルパー ---------------- */

function starPath(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = Math.PI / 5 * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}
function diamondPath(cx, cy, r) { return `M${cx},${cy-r} L${cx+r},${cy} L${cx},${cy+r} L${cx-r},${cy} Z`; }
function trianglePath(cx, cy, r) {
  const h = r * 1.6;
  return `M${cx},${cy-h*0.65} L${cx+h*0.6},${cy+h*0.45} L${cx-h*0.6},${cy+h*0.45} Z`;
}
function squarePath(cx, cy, r) {
  const s = r * 0.85;
  return `M${cx-s},${cy-s} L${cx+s},${cy-s} L${cx+s},${cy+s} L${cx-s},${cy+s} Z`;
}
function hexagonPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 3 * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}
function createNodeShapeEl(n, r, selected) {
  const color = colorMap[n.type] || '#888780';
  let el;
  if (n.type === 'exhibit') { el = document.createElementNS(svgNS, 'path'); el.setAttribute('d', starPath(n.x, n.y, r*1.3, r*0.55)); }
  else if (n.type === 'toilet') { el = document.createElementNS(svgNS, 'path'); el.setAttribute('d', hexagonPath(n.x, n.y, r*1.1)); }
  else if (n.type === 'room') { el = document.createElementNS(svgNS, 'path'); el.setAttribute('d', squarePath(n.x, n.y, r)); }
  else if (n.type === 'entrance') { el = document.createElementNS(svgNS, 'path'); el.setAttribute('d', trianglePath(n.x, n.y, r)); }
  else if (n.type === 'stairs') { el = document.createElementNS(svgNS, 'path'); el.setAttribute('d', diamondPath(n.x, n.y, r*1.15)); }
  else { el = document.createElementNS(svgNS, 'circle'); el.setAttribute('cx', n.x); el.setAttribute('cy', n.y); el.setAttribute('r', r); }
  el.setAttribute('fill', color);
  el.setAttribute('stroke', selected ? '#000' : '#fff');
  el.setAttribute('stroke-width', selected ? 4 : 3);
  return el;
}
