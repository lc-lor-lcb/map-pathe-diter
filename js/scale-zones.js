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
  if (selectedZoneId === id) {
    selectedZoneId = null;
    selectedZoneVertexIndex = -1;
  }
  renderAll();
}

/* ---------------- 規制エリア(区画)の移動 ---------------- */

let zoneDragState = null;
let zoneDragSuppressClickUntil = 0;

/** 規制エリア移動モードのON/OFF */
function toggleZoneMoveMode() {
  zoneMoveMode = !zoneMoveMode;
  selectedZoneVertexIndex = -1;
  if (zoneMoveMode) {
    // 他のクリック指定モードとは排他
    midpointPickMode = false;
    midpointPickCells = [];
    midpointTargetId = null;
    transformPickMode = false;
    updateMidpointMoveUI();
    renderStatus('規制エリア編集モードON: 本体ドラッグで全体移動、白い丸(頂点)ドラッグで1点だけ移動できます。区画一覧の「編集」からも開始できます');
  } else {
    selectedZoneId = null;
    renderStatus('規制エリア編集モードOFF');
  }
  updateZoneMoveUI();
  renderOverlay();
}

function updateZoneMoveUI() {
  const btn = document.getElementById('zoneMoveToggleBtn');
  if (!btn) return;
  btn.classList.toggle('active', zoneMoveMode);
  btn.textContent = zoneMoveMode
    ? '規制エリア編集モード中(クリックでOFF)'
    : '規制エリアの移動 / 頂点編集';
}

/** 一覧の「移動」から、その区画を選択して移動モードに入る */
function beginZoneMove(id) {
  const z = zones.find(zz => zz.id === id);
  if (!z) return;
  zoneMoveMode = true;
  selectedZoneId = id;
  selectedZoneVertexIndex = -1;
  if (z.floor !== currentFloor) switchFloor(z.floor);
  updateZoneMoveUI();
  renderAll();
  renderStatus(`区画「${z.label}」を選択しました。本体をドラッグで全体移動、白い丸(頂点)をドラッグで1点だけ移動できます`);
}

function startZoneDrag(z, ev) {
  zoneDragState = {
    zoneId: z.id,
    startClientX: ev.clientX,
    startClientY: ev.clientY,
    origPoints: z.points.map(p => ({ x: p.x, y: p.y })),
    moved: false,
  };
  selectedZoneId = z.id;
  selectedZoneVertexIndex = -1;
  selectedNodeIds = [];
  selectedListNodeId = null;
  selectedEdgeId = null;
  window.addEventListener('mousemove', onZoneDragMove);
  window.addEventListener('mouseup', onZoneDragEnd);
  renderOverlay();
}

function onZoneDragMove(ev) {
  if (!zoneDragState) return;
  const z = zones.find(zz => zz.id === zoneDragState.zoneId);
  if (!z) return;
  const screenDx = ev.clientX - zoneDragState.startClientX;
  const screenDy = ev.clientY - zoneDragState.startClientY;
  if (!zoneDragState.moved && (Math.abs(screenDx) > 3 || Math.abs(screenDy) > 3)) {
    pushHistory();
    zoneDragState.moved = true;
  }
  if (!zoneDragState.moved) return;

  let dx = screenDx / zoom;
  let dy = screenDy / zoom;
  // 格子ON時は区画の1点目を格子点に合わせ、その移動量を全頂点に適用する
  if (gridVisible && gridSize > 0) {
    const o = zoneDragState.origPoints[0];
    const s = snapPoint(o.x + dx, o.y + dy);
    dx = s.x - o.x;
    dy = s.y - o.y;
  }
  z.points = zoneDragState.origPoints.map(p => ({
    x: Math.round((p.x + dx) * 100) / 100,
    y: Math.round((p.y + dy) * 100) / 100,
  }));
  renderOverlay();
}

function onZoneDragEnd() {
  if (!zoneDragState) return;
  window.removeEventListener('mousemove', onZoneDragMove);
  window.removeEventListener('mouseup', onZoneDragEnd);
  const moved = zoneDragState.moved;
  const z = zones.find(zz => zz.id === zoneDragState.zoneId);
  zoneDragState = null;
  if (moved) {
    zoneDragSuppressClickUntil = performance.now() + 300;
    renderAll();
    renderStatus(z ? `区画「${z.label}」を移動しました。Ctrl+Zで戻せます` : '区画を移動しました');
  } else {
    renderOverlay();
    renderStatus(z ? `区画「${z.label}」を選択しました。本体ドラッグで全体移動、白い丸(頂点)ドラッグで1点だけ移動できます` : '');
  }
}

/* ---------------- 規制エリアの頂点(1点)編集 ---------------- */

let zoneVertexDrag = null;

function startZoneVertexDrag(z, index, ev) {
  zoneVertexDrag = {
    zoneId: z.id,
    index,
    startClientX: ev.clientX,
    startClientY: ev.clientY,
    orig: { x: z.points[index].x, y: z.points[index].y },
    moved: false,
  };
  selectedZoneId = z.id;
  selectedZoneVertexIndex = index;
  selectedNodeIds = [];
  selectedListNodeId = null;
  selectedEdgeId = null;
  window.addEventListener('mousemove', onZoneVertexDragMove);
  window.addEventListener('mouseup', onZoneVertexDragEnd);
  renderOverlay();
}

function onZoneVertexDragMove(ev) {
  if (!zoneVertexDrag) return;
  const z = zones.find(zz => zz.id === zoneVertexDrag.zoneId);
  if (!z) return;
  const screenDx = ev.clientX - zoneVertexDrag.startClientX;
  const screenDy = ev.clientY - zoneVertexDrag.startClientY;
  if (!zoneVertexDrag.moved && (Math.abs(screenDx) > 3 || Math.abs(screenDy) > 3)) {
    pushHistory();
    zoneVertexDrag.moved = true;
  }
  if (!zoneVertexDrag.moved) return;

  let nx = zoneVertexDrag.orig.x + screenDx / zoom;
  let ny = zoneVertexDrag.orig.y + screenDy / zoom;
  // 近くの経路ノードを優先して吸着 → なければ格子
  const near = snapToNearbyNode(nx, ny, z.floor);
  if (near) {
    nx = near.x;
    ny = near.y;
  } else if (gridVisible && gridSize > 0) {
    const s = snapPoint(nx, ny);
    nx = s.x;
    ny = s.y;
  }
  z.points[zoneVertexDrag.index] = {
    x: Math.round(nx * 100) / 100,
    y: Math.round(ny * 100) / 100,
  };
  renderOverlay();
}

function onZoneVertexDragEnd() {
  if (!zoneVertexDrag) return;
  window.removeEventListener('mousemove', onZoneVertexDragMove);
  window.removeEventListener('mouseup', onZoneVertexDragEnd);
  const moved = zoneVertexDrag.moved;
  const z = zones.find(zz => zz.id === zoneVertexDrag.zoneId);
  const idx = zoneVertexDrag.index;
  zoneVertexDrag = null;
  if (moved) {
    zoneDragSuppressClickUntil = performance.now() + 300;
    renderAll();
    const p = z && z.points[idx];
    renderStatus(p
      ? `区画「${z.label}」の頂点${idx + 1}を(${p.x}, ${p.y})へ移動しました。Ctrl+Zで戻せます`
      : '区画の頂点を移動しました');
  } else {
    renderOverlay();
    const p = z && z.points[idx];
    renderStatus(z && p
      ? `区画「${z.label}」の頂点${idx + 1}を選択しました(${p.x}, ${p.y})。ドラッグまたは矢印キーで移動できます`
      : '');
  }
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
