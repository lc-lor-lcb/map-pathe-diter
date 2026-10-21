/* ---------------- 初期化 ---------------- */

function init() {
  const restored = tryRestore();

  renderFloorTabs();
  switchFloor(floorOrder.includes('floor_1F') ? 'floor_1F' : floorOrder[0]);
  setMode('node');

  document.getElementById('modeNode').onclick = () => setMode('node');
  document.getElementById('modeEdge').onclick = () => setMode('edge');
  document.getElementById('modeZone').onclick = () => setMode('zone');
  document.getElementById('modeRoute').onclick = () => setMode('route');

  document.getElementById('exportBtn').onclick = exportJson;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = importJson;
  document.getElementById('resetAllBtn').onclick = resetAll;
  document.getElementById('undoBtn').onclick = undo;

  document.getElementById('importImageBtn').onclick = () => document.getElementById('importImageFile').click();
  document.getElementById('importImageFile').onchange = handleImageImport;
  document.getElementById('calibrateBtn').onclick = () => {
    calibrating = true;
    calibPoints = [];
    renderStatus('縮尺校正: 実際の距離がわかる2点を順にクリックしてください(例: 廊下の端から端、扉の幅など)');
    renderOverlay();
  };
  document.getElementById('clearScaleBtn').onclick = () => {
    if (floorScale[currentFloor]) {
      pushHistory();
      delete floorScale[currentFloor];
      renderScaleInfo();
      autosave();
      renderStatus('この階の縮尺設定をリセットしました');
    }
  };

  document.getElementById('labelToggle').onchange = (e) => {
    showLabels = e.target.checked;
    renderOverlay();
  };

  document.getElementById('chainMode').onchange = (e) => { chainMode = e.target.checked; };
  document.getElementById('crossFloorMode').onchange = (e) => {
    crossFloorMode = e.target.checked;
    renderStatus(crossFloorMode ? '階またぎ接続モードON: 他階のノードとも接続できます' : '階またぎ接続モードOFF');
  };

  document.getElementById('zoneFinishBtn').onclick = finishZone;
  document.getElementById('zoneUndoPointBtn').onclick = () => { currentZonePoints.pop(); renderOverlay(); };
  document.getElementById('zoneClearBtn').onclick = () => { currentZonePoints = []; renderOverlay(); renderStatus('下書きをクリアしました'); };

  document.getElementById('nodeSearch').oninput = (e) => { nodeSearchTerm = e.target.value; renderNodeList(); };

  document.getElementById('selectFloorNodesBtn').onclick = selectAllNodesOnFloor;
  document.getElementById('pickAnchorBtn').onclick = pickTransformAnchor;
  document.getElementById('applyTransformBtn').onclick = applyFloorTransform;
  document.getElementById('transformAnchor').onchange = (e) => {
    if (e.target.value === 'custom' && !transformAnchorPoint) { pickTransformAnchor(); return; }
    updateTransformInfo();
    renderOverlay();
  };
  ['transformRatio', 'transformDx', 'transformDy'].forEach(id => {
    document.getElementById(id).oninput = updateTransformInfo;
  });
  ['transformRatio', 'transformDx', 'transformDy'].forEach(id => {
    document.getElementById(id).onkeydown = (e) => { if (e.key === 'Enter') applyFloorTransform(); };
  });
  document.getElementById('transformZonesToggle').onchange = updateTransformInfo;
  document.getElementById('transformScaleToggle').onchange = updateTransformInfo;

  document.getElementById('zoomIn').onclick = () => zoomAtCenter(1.25);
  document.getElementById('zoomOut').onclick = () => zoomAtCenter(0.8);
  document.getElementById('zoomReset').onclick = () => fitToViewport();

  setupPanZoomEvents();
  setupKeyboardShortcuts();
  window.addEventListener('resize', () => fitToViewport());

  renderAll();
  renderScaleInfo();
  if (restored) {
    renderStatus(`前回の続きを自動復元しました(ノード${nodes.length} / エッジ${edges.length} / 区画${zones.length} / 追加画像${Object.keys(customImages).length})`);
  }
}
