/* ---------------- クリックでの新規追加/区画頂点追加 ---------------- */

let mouseMovedDuringDown = false;
document.getElementById('mainViewport').addEventListener('mousedown', () => { mouseMovedDuringDown = false; });
document.getElementById('mainViewport').addEventListener('mousemove', () => { if (isPanning) mouseMovedDuringDown = true; });

document.getElementById('imgwrap').addEventListener('click', (e) => {
  // 区画下書き中・校正中・基準点指定中はノード上でも拾えるようにする
  if (mode !== 'zone' && !calibrating && !transformPickMode && e.target.closest('.node-dot')) return;
  if (mouseMovedDuringDown) return;
  if (isSpaceDown) return;

  const viewport = document.getElementById('mainViewport');
  const rect = viewport.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left - panX) / zoom);
  const y = Math.round((e.clientY - rect.top - panY) / zoom);

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
    addNode(x, y);
  } else if (mode === 'zone') {
    currentZonePoints.push({x, y});
    renderOverlay();
    renderStatus(`区画の頂点を${currentZonePoints.length}個置きました。3点以上で「区画を確定」できます`);
  }
});