/* ---------------- ズーム/パン ---------------- */

function applyTransform() {
  document.getElementById('imgwrap').style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
}
function zoomAtCenter(factor) {
  const viewport = document.getElementById('mainViewport');
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, factor);
}
function zoomAt(cx, cy, factor) {
  const newZoom = Math.max(0.2, Math.min(4, zoom * factor));
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
}
