/* ---------------- 縮尺校正 ---------------- */

function handleCalibrationClick(x, y) {
  calibPoints.push({ x, y });
  if (calibPoints.length === 1) {
    renderStatus('1点目を記録しました。2点目をクリックしてください');
    renderOverlay();
    return;
  }
  const [p1, p2] = calibPoints;
  const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const input = prompt('この2点の実際の距離は何メートルですか？(例: 8.4)', '');
  calibrating = false;
  calibPoints = [];
  const meters = parseFloat(input);
  if (!input || isNaN(meters) || meters <= 0) {
    renderStatus('縮尺設定をキャンセルしました');
    renderOverlay();
    return;
  }
  pushHistory();
  floorScale[currentFloor] = pxDist / meters;
  renderScaleInfo();
  renderOverlay();
  autosave();
  renderStatus(`${floorLabels[currentFloor]}の縮尺を設定しました(1m ≈ ${Math.round(floorScale[currentFloor])}px)`);
}

function renderScaleInfo() {
  const el = document.getElementById('scaleInfo');
  if (!el) return;
  const scale = floorScale[currentFloor];
  el.textContent = scale
    ? `${floorLabels[currentFloor]}の縮尺: 1m ≈ ${Math.round(scale)}px (校正済み。エッジ一覧・経路テストに実寸が表示されます)`
    : `${floorLabels[currentFloor]}: 未校正(経路の最短判定には影響しません。実寸表示だけ使えません)`;
}

function pxToRealMeters(px, floorId) {
  const s = floorScale[floorId];
  return s ? px / s : null;
}

function summarizeRouteDistance(path) {
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodes.find(n => n.id === path[i]);
    const b = nodes.find(n => n.id === path[i + 1]);
    if (!a || !b || a.floor !== b.floor) continue; // 階またぎ区間は距離計算の対象外
    const pxDist = Math.hypot(a.x - b.x, a.y - b.y);
    const meters = pxToRealMeters(pxDist, a.floor);
    const last = segments[segments.length - 1];
    if (last && last.floor === a.floor) {
      last.meters = (meters !== null && last.meters !== null) ? last.meters + meters : null;
    } else {
      segments.push({ floor: a.floor, meters });
    }
  }
  return segments;
}

function finishZone() {
  if (currentZonePoints.length < 3) { renderStatus('区画には3点以上の頂点が必要です'); return; }
  pushHistory();
  const id = 'Z' + String(zoneSeq++).padStart(3, '0');
  zones.push({ id, floor: currentFloor, points: currentZonePoints, label: id });
  currentZonePoints = [];
  renderAll();
  renderStatus(`区画 ${id} を作成しました。一覧から「通行止めにする」を押すと、この区画内の通路をまとめて規制できます`);
}
function deleteZone(id) {
  pushHistory();
  zones = zones.filter(z => z.id !== id);
  renderAll();
}
function isPointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function applyZoneBlock(zoneId, blockedValue) {
  const z = zones.find(zz => zz.id === zoneId);
  if (!z) return;
  pushHistory();
  let count = 0;
  edges.forEach(ed => {
    const a = nodes.find(n => n.id === ed.from);
    const b = nodes.find(n => n.id === ed.to);
    if (!a || !b || a.floor !== z.floor || b.floor !== z.floor) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (isPointInPolygon(mid, z.points)) { ed.blocked = blockedValue; count++; }
  });
  renderAll();
  renderStatus(`${z.label}: ${count}本のエッジを${blockedValue ? '通行止め' : '通行可'}にしました`);
}
