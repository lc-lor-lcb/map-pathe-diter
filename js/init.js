/* ---------------- 初期化 ---------------- */

function init() {
  const restored = tryRestore();

  // will-change: transform が付いていると、高倍率でSVGやラスタ化がぼやけることがあるため外す
  document.getElementById('imgwrap').style.willChange = 'auto';

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

  // 格子の表示/スナップ
  document.getElementById('gridToggle').onchange = (e) => {
    gridVisible = e.target.checked;
    renderOverlay();
    renderStatus(gridVisible
      ? `格子ON(${gridSize}px): ノード追加・ドラッグ移動・区画頂点が格子点にスナップします`
      : '格子OFF: スナップも無効です');
  };
  document.getElementById('gridSize').onchange = (e) => {
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v < 1) {
      e.target.value = String(gridSize);
      renderStatus('格子の間隔は1以上の数値で入力してください');
      return;
    }
    gridSize = v;
    renderOverlay();
    renderStatus(`格子の間隔を${gridSize}pxにしました`);
  };
  document.getElementById('snapNodesBtn').onclick = snapTargetNodesToGrid;

  // ノード図形・ノード名の表示サイズ調整(見た目のみ、Undo対象外)
  const nodeSizeRange = document.getElementById('nodeSizeRange');
  const labelSizeRange = document.getElementById('labelSizeRange');
  nodeSizeRange.oninput = (e) => {
    nodeScale = Math.max(0.1, Math.min(3, (parseInt(e.target.value, 10) || 100) / 100));
    document.getElementById('nodeSizeValue').textContent = Math.round(nodeScale * 100) + '%';
    renderOverlay();
  };
  nodeSizeRange.onchange = autosave;
  labelSizeRange.oninput = (e) => {
    labelFontSize = Math.max(6, Math.min(48, parseInt(e.target.value, 10) || 11));
    document.getElementById('labelSizeValue').textContent = Math.round(labelFontSize) + 'px';
    renderOverlay();
  };
  labelSizeRange.onchange = autosave;
  syncSizeControls();

  document.getElementById('midpointMoveBtn').onclick = startMidpointMovePick;
  document.getElementById('zoneMoveToggleBtn').onclick = toggleZoneMoveMode;
  updateMidpointMoveUI();
  updateZoneMoveUI();

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

// スライダーと数値表示を現在の設定値に合わせる(復元・読み込み・全消去後にも呼ぶ)
function syncSizeControls() {
  const nr = document.getElementById('nodeSizeRange');
  const lr = document.getElementById('labelSizeRange');
  if (!nr || !lr) return;
  nr.value = String(Math.round(nodeScale * 100));
  document.getElementById('nodeSizeValue').textContent = Math.round(nodeScale * 100) + '%';
  lr.value = String(Math.round(labelFontSize));
  document.getElementById('labelSizeValue').textContent = Math.round(labelFontSize) + 'px';
}

// 中点移動ボタンとカーソル表示を現在のモードに合わせる
function updateMidpointMoveUI() {
  const btn = document.getElementById('midpointMoveBtn');
  const vp = document.getElementById('mainViewport');
  if (btn) {
    btn.classList.toggle('active', midpointPickMode);
    btn.textContent = midpointPickMode
      ? '中点移動中: 格子を2つクリック(Escで中止)'
      : '選択ノードを格子2マスの中点へ移動';
  }
  if (vp) vp.classList.toggle('midpoint-pick', midpointPickMode);
}