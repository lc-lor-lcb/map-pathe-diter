/* ---------------- ズーム/パン ---------------- */

function applyTransform() {
  document.getElementById('imgwrap').style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  if (typeof updateGridStyle === 'function') updateGridStyle();
}
function zoomAtCenter(factor) {
  const viewport = document.getElementById('mainViewport');
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, factor);
}
function zoomAt(cx, cy, factor) {
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
  const actualFactor = newZoom / zoom;
  panX = cx - actualFactor * (cx - panX);
  panY = cy - actualFactor * (cy - panY);
  zoom = newZoom;
  applyTransform();
}
function fitToViewport() {
  const img = document.getElementById('floorImg');
  const viewport = document.getElementById('mainViewport');
  if (!img.naturalWidth) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const scale = Math.min(vw / img.naturalWidth, vh / img.naturalHeight) * 0.95;
  zoom = scale;
  panX = (vw - img.naturalWidth * scale) / 2;
  panY = (vh - img.naturalHeight * scale) / 2;
  applyTransform();
}
function setupPanZoomEvents() {
  const viewport = document.getElementById('mainViewport');
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1/1.12);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { isSpaceDown = true; }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { isSpaceDown = false; }
  });
  // Spaceを押したままフォーカスを失うとisSpaceDownが残り、
  // 空クリック(ノード追加・区画頂点)が全滅するため、フォーカス喪失時に必ず解除する
  const clearSpacePan = () => { isSpaceDown = false; isPanning = false; viewport.classList.remove('panning'); };
  window.addEventListener('blur', clearSpacePan);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearSpacePan(); });

  viewport.addEventListener('mousedown', (e) => {
    const wantsPan = isSpaceDown || e.button === 2 || e.button === 1;
    if (!wantsPan) return;
    e.preventDefault();
    isPanning = true;
    viewport.classList.add('panning');
    panStart = { x: e.clientX, y: e.clientY, panX, panY };
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = panStart.panX + (e.clientX - panStart.x);
    panY = panStart.panY + (e.clientY - panStart.y);
    applyTransform();
  });
  window.addEventListener('mouseup', () => { isPanning = false; viewport.classList.remove('panning'); });
  viewport.addEventListener('contextmenu', (e) => e.preventDefault());

  viewport.addEventListener('mousemove', (e) => {
    if (mode === 'edge' && selectedNodeId) {
      const rect = viewport.getBoundingClientRect();
      previewPoint = { x: (e.clientX - rect.left - panX) / zoom, y: (e.clientY - rect.top - panY) / zoom };
      updatePreviewLine();
    }
  });

  // ---- Shift+ドラッグで矩形内のノードをまとめて選択 ----
  // ノード上から始めても矩形選択できるよう、captureで先に受け取って
  // ノードのドラッグ処理には渡さない。
  viewport.addEventListener('mousedown', (e) => {
    rectSelectSuppressClickUntil = 0;   // 前回のクリック抑制を解除
    if (!e.shiftKey || e.button !== 0 || isSpaceDown) return;
    if (mode !== 'node' || calibrating || transformPickMode) return;
    const p = imagePointFromEvent(e);
    e.preventDefault();
    e.stopPropagation();
    rectSelectState = { startX: p.x, startY: p.y, curX: p.x, curY: p.y };
    window.addEventListener('mousemove', onRectSelectMove);
    window.addEventListener('mouseup', finishRectSelect);
    updateRectSelectBox();
  }, true);

  // 矩形選択直後に発火するclickで、新規ノード追加や選択解除が走らないようにする
  viewport.addEventListener('click', (e) => {
    if (performance.now() < rectSelectSuppressClickUntil) {
      rectSelectSuppressClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function imagePointFromEvent(e) {
  const viewport = document.getElementById('mainViewport');
  const rect = viewport.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - panX) / zoom,
    y: (e.clientY - rect.top - panY) / zoom,
  };
}

let rectSelectSuppressClickUntil = 0;

function updateRectSelectBox() {
  if (!rectSelectState) return;
  const svg = document.getElementById('overlay');
  let box = document.getElementById('rectSelectBox');
  if (!box) {
    box = document.createElementNS(svgNS, 'rect');
    box.setAttribute('id', 'rectSelectBox');
    box.setAttribute('fill', '#E8843A');
    box.setAttribute('fill-opacity', '0.12');
    box.setAttribute('stroke', '#E8843A');
    box.setAttribute('stroke-dasharray', '6 4');
    box.style.pointerEvents = 'none';
    svg.appendChild(box);
  }
  const s = rectSelectState;
  box.setAttribute('x', Math.min(s.startX, s.curX));
  box.setAttribute('y', Math.min(s.startY, s.curY));
  box.setAttribute('width', Math.abs(s.curX - s.startX));
  box.setAttribute('height', Math.abs(s.curY - s.startY));
  box.setAttribute('stroke-width', String(1.5 / zoom));
}

function onRectSelectMove(e) {
  if (!rectSelectState) return;
  const p = imagePointFromEvent(e);
  rectSelectState.curX = p.x;
  rectSelectState.curY = p.y;
  updateRectSelectBox();
}

function finishRectSelect() {
  if (!rectSelectState) return;
  window.removeEventListener('mousemove', onRectSelectMove);
  window.removeEventListener('mouseup', finishRectSelect);
  const s = rectSelectState;
  rectSelectState = null;
  const box = document.getElementById('rectSelectBox');
  if (box) box.remove();

  // 画面上でほとんど動いていない場合はただのShift+クリックとみなす
  if (Math.abs(s.curX - s.startX) * zoom < 3 && Math.abs(s.curY - s.startY) * zoom < 3) return;

  const x1 = Math.min(s.startX, s.curX), x2 = Math.max(s.startX, s.curX);
  const y1 = Math.min(s.startY, s.curY), y2 = Math.max(s.startY, s.curY);
  const hitIds = nodes
    .filter(n => n.floor === currentFloor && n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2)
    .map(n => n.id);

  // Shift+ドラッグは「追加選択」。既に選んでいるノードは維持する。
  const merged = Array.from(new Set([...selectedNodeIds, ...hitIds]));
  selectedNodeIds = merged;
  selectedListNodeId = null;
  selectedEdgeId = null;
  pendingAlignAxis = null;
  rectSelectSuppressClickUntil = performance.now() + 300;

  renderNodeList();
  renderOverlay();
  renderMultiSelectPanel();
  renderStatus(hitIds.length
    ? `矩形内の${hitIds.length}個を選択に追加しました(選択中 ${selectedNodeIds.length}個)`
    : '矩形内にノードがありませんでした');
}