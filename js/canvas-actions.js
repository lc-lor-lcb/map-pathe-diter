/* ---------------- クリックでの新規追加/区画頂点追加 ---------------- */

let mouseMovedDuringDown = false;
document.getElementById('mainViewport').addEventListener('mousedown', () => { mouseMovedDuringDown = false; });
document.getElementById('mainViewport').addEventListener('mousemove', () => { if (isPanning) mouseMovedDuringDown = true; });

document.getElementById('imgwrap').addEventListener('click', (e) => {
  if (mouseMovedDuringDown || isSpaceDown) return;

  const viewport = document.getElementById('mainViewport');
  const rect = viewport.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left - panX) / zoom);
  const y = Math.round((e.clientY - rect.top - panY) / zoom);

  // 区画ドラッグ直後のclickで選択解除しない
  if (typeof zoneDragSuppressClickUntil === 'number' && performance.now() < zoneDragSuppressClickUntil) {
    zoneDragSuppressClickUntil = 0;
    return;
  }

  // 格子2マスの中点指定中は、ノード上でもマス選択を優先する
  if (midpointPickMode) { handleMidpointPick(x, y); return; }

  // 規制エリア移動モード中は、空白クリックで区画の選択だけ解除する
  if (zoneMoveMode) {
    if (selectedZoneId || selectedZoneVertexIndex >= 0) {
      selectedZoneId = null;
      selectedZoneVertexIndex = -1;
      renderOverlay();
      renderStatus('区画の選択を解除しました');
    }
    return;
  }

  // 区画下書き中・校正中・基準点指定中はノード上でも拾えるようにする
  if (mode !== 'zone' && !calibrating && !transformPickMode && e.target.closest('.node-dot')) return;

  if (calibrating) { handleCalibrationClick(x, y); return; }

  if (transformPickMode) {
    // 近くにノードがあればその位置にスナップ(基準にしやすい)
    let snapped = { x, y };
    let bestD = 15;
    nodes.filter(n => n.floor === currentFloor).forEach(n => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) { bestD = d; snapped = { x: n.x, y: n.y }; }
    });
    transformAnchorPoint = snapped;
    transformPickMode = false;
    const sel = document.getElementById('transformAnchor');
    if (sel) sel.value = 'custom';
    updateTransformInfo();
    renderOverlay();
    renderStatus(`基準点を(${snapped.x}, ${snapped.y})に設定しました。倍率・移動量を入力して「適用」してください`);
    return;
  }

  if (mode === 'node') {
    if (selectedListNodeId || selectedEdgeId || selectedNodeIds.length) {
      // 選択中に空白をクリックした場合は、選択解除だけ行って新規ノードは追加しない
      selectedListNodeId = null;
      selectedEdgeId = null;
      selectedNodeIds = [];
      pendingAlignAxis = null;
      renderAll();
      renderStatus('選択を解除しました');
      return;
    }
    const p = snapPoint(x, y);   // 格子ON時は格子点にスナップ
    addNode(p.x, p.y);
  } else if (mode === 'zone') {
    // 近くに経路ノードがあればその位置、なければ格子点に合わせる
    const near = snapToNearbyNode(x, y, currentFloor);
    const p = near ? { x: near.x, y: near.y } : snapPoint(x, y);
    currentZonePoints.push({ x: p.x, y: p.y });
    renderOverlay();
    renderStatus(`区画の頂点を${currentZonePoints.length}個置きました` +
      (near ? `(ノード${near.node.name}に吸着)` : '') +
      `。3点以上で「区画を確定」できます`);
  }
});