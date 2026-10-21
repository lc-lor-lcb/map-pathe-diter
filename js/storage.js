/* ---------------- 保存/読み込み ---------------- */

function autosave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, zones, nodeSeq, edgeSeq, zoneSeq, floorOrder, floorLabels, customImages, floorScale }));
  } catch (e) {
    renderStatus('自動保存に失敗しました(画像サイズが大きい可能性があります)。念のためJSON書き出しで手動保存してください');
  }
}
function migrateNodeTypes(list) {
  // v6以前の 'stamp' は 'exhibit' (同じ星形・同系色) に移行
  (list || []).forEach(n => { if (n.type === 'stamp') n.type = 'exhibit'; });
}
function tryRestore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    nodes = data.nodes || [];
    migrateNodeTypes(nodes);
    edges = data.edges || [];
    zones = data.zones || [];
    nodeSeq = data.nodeSeq || 1;
    edgeSeq = data.edgeSeq || 1;
    zoneSeq = data.zoneSeq || 1;
    if (data.floorOrder && data.floorOrder.length) floorOrder = data.floorOrder;
    if (data.floorLabels) floorLabels = data.floorLabels;
    if (data.customImages) customImages = data.customImages;
    if (data.floorScale) floorScale = data.floorScale;
    return nodes.length > 0 || edges.length > 0 || zones.length > 0 || Object.keys(customImages).length > 0;
  } catch (e) { return false; }
}
function resetAll() {
  if (!confirm('全てのノード・エッジ・区画データ、追加した画像・縮尺設定を削除して最初からやり直しますか？(この操作はUndoできません。JSONバックアップがあれば読み込みで復元できます)')) return;
  nodes = []; edges = []; zones = []; nodeSeq = 1; edgeSeq = 1; zoneSeq = 1; history = [];
  floorOrder = [...defaultFloorOrder];
  floorLabels = {...defaultFloorLabels};
  customImages = {};
  floorScale = {};
  localStorage.removeItem(STORAGE_KEY);
  renderFloorTabs();
  switchFloor('floor_1F');
  renderAll();
  renderStatus('全データを消去しました');
}
function exportJson() {
  const data = { nodes, edges, zones, floorOrder, floorLabels, customImages, floorScale };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'campus_map_data.json'; a.click();
  URL.revokeObjectURL(url);
}
function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      nodes = data.nodes || [];
      migrateNodeTypes(nodes);
      edges = data.edges || [];
      zones = data.zones || [];
      if (data.floorOrder && data.floorOrder.length) floorOrder = data.floorOrder;
      if (data.floorLabels) floorLabels = data.floorLabels;
      customImages = data.customImages || {};
      floorScale = data.floorScale || {};
      nodeSeq = Math.max(1, ...nodes.map(n => (parseInt(n.id.replace('N','')) || 0) + 1), 1);
      edgeSeq = Math.max(1, ...edges.map(ed => (parseInt(ed.id.replace('E','')) || 0) + 1), 1);
      zoneSeq = Math.max(1, ...zones.map(z => (parseInt(z.id.replace('Z','')) || 0) + 1), 1);
      history = [];
      renderFloorTabs();
      if (!floorOrder.includes(currentFloor)) currentFloor = floorOrder[0];
      switchFloor(currentFloor);
      renderAll();
      renderStatus('読み込み完了');
    } catch (err) {
      renderStatus('読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
}
