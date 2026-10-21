/* ---------------- ノード操作 ---------------- */

function addNode(x, y) {
  pushHistory();
  const id = 'N' + String(nodeSeq++).padStart(3, '0');
  nodes.push({ id, floor: currentFloor, x, y, name: id, type: 'branch' });
  renderAll();
  renderStatus(`ノード ${id} を追加しました。左の一覧から名前・種別を設定できます`);
}

function startNodeDrag(n, ev) {
  dragState = { nodeId: n.id, startClientX: ev.clientX, startClientY: ev.clientY, origX: n.x, origY: n.y, moved: false, multiKey: ev.ctrlKey || ev.metaKey };
  window.addEventListener('mousemove', onNodeDragMove);
  window.addEventListener('mouseup', onNodeDragEnd);
}
function onNodeDragMove(ev) {
  if (!dragState) return;
  const dx = (ev.clientX - dragState.startClientX) / zoom;
  const dy = (ev.clientY - dragState.startClientY) / zoom;
  if (!dragState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
    pushHistory();
    dragState.moved = true;
  }
  if (dragState.moved) {
    // 複数選択中にドラッグした場合は、選択されている全ノードを一緒に動かす
    const targets = (selectedNodeIds.includes(dragState.nodeId) && selectedNodeIds.length > 1)
      ? selectedNodeIds
      : [dragState.nodeId];
    if (!dragState.origPositions) {
      dragState.origPositions = {};
      targets.forEach(id => {
        const n = nodes.find(nn => nn.id === id);
        dragState.origPositions[id] = { x: n.x, y: n.y };
      });
    }
    targets.forEach(id => {
      const n = nodes.find(nn => nn.id === id);
      const orig = dragState.origPositions[id];
      n.x = Math.round(orig.x + dx);
      n.y = Math.round(orig.y + dy);
    });
    renderOverlay();
  }
}
function onNodeDragEnd() {
  if (!dragState) return;
  window.removeEventListener('mousemove', onNodeDragMove);
  window.removeEventListener('mouseup', onNodeDragEnd);
  if (!dragState.moved) {
    if (dragState.multiKey) {
      // Ctrl/Cmd+クリック: 複数選択のトグル
      const idx = selectedNodeIds.indexOf(dragState.nodeId);
      if (idx === -1) {
        selectedNodeIds.push(dragState.nodeId);
      } else {
        selectedNodeIds.splice(idx, 1);
      }
      selectedListNodeId = null;
      selectedEdgeId = null;
      renderStatus(selectedNodeIds.length ? `${selectedNodeIds.length}個のノードを選択中` : '選択を解除しました');
    } else {
      // 通常クリック: 複数選択はクリアして単一選択に切り替え
      selectedNodeIds = [];
      selectedListNodeId = dragState.nodeId;
      selectedEdgeId = null;
    }
    renderNodeList();
    renderOverlay();
  } else {
    renderStatus('ノードを移動しました');
    renderAll();
  }
  dragState = null;
}

function nodeClicked(node) {
  if (mode === 'edge') {
    if (!selectedNodeId) {
      selectedNodeId = node.id;
      previewPoint = null;
      renderStatus(`「${node.name}」を選択中。接続先のノードをクリックしてください`);
      renderOverlay();
      return;
    }
    if (selectedNodeId === node.id) {
      selectedNodeId = null;
      renderStatus('選択を解除しました');
      renderOverlay();
      return;
    }
    const a = nodes.find(n => n.id === selectedNodeId);
    if (a.floor !== node.floor && !crossFloorMode) {
      renderStatus('異なる階のノードです。「階またぎ接続モード」をONにすると接続できます');
      return;
    }
    const exists = edges.find(ed =>
      (ed.from === selectedNodeId && ed.to === node.id) ||
      (ed.from === node.id && ed.to === selectedNodeId));
    if (exists) {
      renderStatus('そのエッジは既に存在します');
    } else {
      pushHistory();
      const id = 'E' + String(edgeSeq++).padStart(3, '0');
      edges.push({ id, from: selectedNodeId, to: node.id, blocked: false, crossFloor: a.floor !== node.floor });
      renderStatus(`エッジ ${id} を作成: ${a.name} - ${node.name}`);
    }
    selectedNodeId = chainMode ? node.id : null;
    renderAll();
  } else if (mode === 'route') {
    if (!routeStart || (routeStart && routeEnd)) {
      routeStart = node.id; routeEnd = null; routePath = null;
      renderStatus(`スタート: 「${node.name}」。ゴールにするノードをクリックしてください`);
    } else {
      routeEnd = node.id;
      routePath = computeRoute(routeStart, routeEnd);
      const sName = nodes.find(n=>n.id===routeStart).name;
      if (routePath) {
        const floorSeq = [];
        routePath.forEach(id => {
          const fl = nodes.find(n=>n.id===id).floor;
          if (floorSeq[floorSeq.length-1] !== fl) floorSeq.push(fl);
        });
        renderStatus(`経路が見つかりました: ${sName} → ${node.name} (${routePath.length}ノード経由, ${floorSeq.map(f=>floorLabels[f]).join('→')})`);
      } else {
        renderStatus(`「${sName}」→「${node.name}」は現在の通行設定では繋がっていません(通行止め、または未接続の可能性があります)`);
      }
    }
    updateRouteInfo();
    renderAll();
  }
}

function deleteNode(id) {
  pushHistory();
  nodes = nodes.filter(n => n.id !== id);
  edges = edges.filter(ed => ed.from !== id && ed.to !== id);
  if (selectedNodeId === id) selectedNodeId = null;
  selectedNodeIds = selectedNodeIds.filter(nid => nid !== id);
  renderAll();
}
function deleteEdge(id) {
  pushHistory();
  edges = edges.filter(ed => ed.id !== id);
  if (selectedEdgeId === id) selectedEdgeId = null;
  renderAll();
}

function clearMultiSelection() {
  if (!selectedNodeIds.length) return;
  selectedNodeIds = [];
  renderNodeList();
  renderOverlay();
}

function deleteSelectedNodes() {
  if (!selectedNodeIds.length) return;
  // 全選択のまま誤ってDeleteを押しても一括削除しないよう、多数選択時は確認する
  if (selectedNodeIds.length >= 10 &&
      !confirm(`選択中の${selectedNodeIds.length}個のノードを削除しますか？(エッジも一緒に消えます)`)) return;
  pushHistory();
  const idsToDelete = new Set(selectedNodeIds);
  nodes = nodes.filter(n => !idsToDelete.has(n.id));
  edges = edges.filter(ed => !idsToDelete.has(ed.from) && !idsToDelete.has(ed.to));
  const count = selectedNodeIds.length;
  selectedNodeIds = [];
  renderAll();
  renderStatus(`${count}個のノードを削除しました`);
}

/**
 * 複数選択されたノードを、基準ノードのx(縦整列)またはy(横整列)に揃える。
 * @param {'x'|'y'} axis - 'x'なら基準ノードのx座標に揃えて縦一列に、'y'ならy座標に揃えて横一列にする
 * @param {string} baseNodeId - 基準にするノードのID(選択中のいずれか)
 */
function alignSelectedNodes(axis, baseNodeId) {
  if (selectedNodeIds.length < 2) {
    renderStatus('整列するには2つ以上のノードを選択してください(Ctrl/Cmd+クリックで複数選択)');
    return;
  }
  const base = nodes.find(n => n.id === baseNodeId);
  if (!base) return;
  pushHistory();
  selectedNodeIds.forEach(id => {
    if (id === baseNodeId) return;
    const n = nodes.find(nn => nn.id === id);
    if (!n) return;
    if (axis === 'x') n.x = base.x; else n.y = base.y;
  });
  renderAll();
  renderStatus(`${selectedNodeIds.length}個のノードを「${base.name}」に${axis === 'x' ? '縦' : '横'}整列しました`);
}

/**
 * 選択中のノード(複数選択優先、なければ単一選択)を矢印キーで1pxずつ動かす。
 * 呼び出し側(setupKeyboardShortcuts)で履歴の積み方を制御するため、ここではpushHistoryしない。
 * @param {number} dx
 * @param {number} dy
 */
function nudgeSelectedNodes(dx, dy) {
  const targets = selectedNodeIds.length ? selectedNodeIds : (selectedListNodeId ? [selectedListNodeId] : []);
  if (!targets.length) return false;
  targets.forEach(id => {
    const n = nodes.find(nn => nn.id === id);
    if (n) { n.x += dx; n.y += dy; }
  });
  renderAll();
  return true;
}