/* ---------------- 画像差し替え後のノード再位置合わせ ---------------- */
/* 画像を差し替えて画素サイズが変わっても、その階のノード配置を
   「基準点 + 倍率 + 移動量」でまとめて変換し、元の並びのまま合わせられるようにする。 */

// 変換対象: 選択中のノード。未選択なら現在の階の全ノード。
function getTransformTargets() {
  if (selectedNodeIds.length) return nodes.filter(n => selectedNodeIds.includes(n.id));
  return nodes.filter(n => n.floor === currentFloor);
}

// この階のノードを全選択(既存の複数選択/ドラッグ移動をそのまま使える)
function selectAllNodesOnFloor() {
  const ids = nodes.filter(n => n.floor === currentFloor).map(n => n.id);
  selectedNodeIds = ids;
  selectedListNodeId = null;
  selectedEdgeId = null;
  pendingAlignAxis = null;
  renderNodeList();
  renderOverlay();
  renderMultiSelectPanel();
  updateTransformInfo();
  renderStatus(`${floorLabels[currentFloor]}のノード${ids.length}個を選択しました。倍率・移動量を入力して「適用」してください`);
}

function pickTransformAnchor() {
  transformPickMode = true;
  updateTransformInfo();
  renderStatus('基準点にしたい位置を地図上でクリックしてください(画像の角や、動かしたくないノードの位置など)');
}

// 基準点を決める。'custom' なのに未指定なら null(適用時にエラー表示)
function resolveTransformAnchor(targets) {
  const el = document.getElementById('transformAnchor');
  const mode = el ? el.value : 'centroid';
  if (mode === 'origin') return { x: 0, y: 0 };
  if (mode === 'custom') return transformAnchorPoint ? { x: transformAnchorPoint.x, y: transformAnchorPoint.y } : null;
  let sx = 0, sy = 0;
  targets.forEach(n => { sx += n.x; sy += n.y; });
  return { x: sx / targets.length, y: sy / targets.length };
}

function applyFloorTransform() {
  const targets = getTransformTargets();
  if (!targets.length) {
    renderStatus('対象ノードがありません。「この階のノードを全選択」を押してください');
    return;
  }
  const ratioRaw = parseFloat(document.getElementById('transformRatio').value);
  const dxRaw = parseFloat(document.getElementById('transformDx').value);
  const dyRaw = parseFloat(document.getElementById('transformDy').value);
  const ratio = isNaN(ratioRaw) ? 1 : ratioRaw / 100;   // 入力は%(100で等倍)
  const dx = isNaN(dxRaw) ? 0 : dxRaw;
  const dy = isNaN(dyRaw) ? 0 : dyRaw;
  if (ratio <= 0) { renderStatus('倍率は0より大きい値を入力してください'); return; }

  const anchor = resolveTransformAnchor(targets);
  if (!anchor) { renderStatus('「指定点(クリック)」を選んだ場合は、先に「基準点をクリックで指定」で位置を決めてください'); return; }

  const updateScale = document.getElementById('transformScaleToggle').checked;
  const includeZonesEl = document.getElementById('transformZonesToggle');
  const includeZones = !includeZonesEl || includeZonesEl.checked;

  pushHistory();
  targets.forEach(n => {
    n.x = Math.round(anchor.x + (n.x - anchor.x) * ratio + dx);
    n.y = Math.round(anchor.y + (n.y - anchor.y) * ratio + dy);
  });

  // 規制エリア(区画)の頂点も、対象ノードと同じ階・同じ基準で一緒に変換する
  const floors = [...new Set(targets.map(n => n.floor))];
  let zoneCount = 0;
  if (includeZones) {
    zones.filter(z => floors.includes(z.floor)).forEach(z => {
      z.points = z.points.map(p => ({
        x: Math.round(anchor.x + (p.x - anchor.x) * ratio + dx),
        y: Math.round(anchor.y + (p.y - anchor.y) * ratio + dy),
      }));
      zoneCount++;
    });
  }

  // 画像の画素サイズが ratio 倍になったので、校正済みの縮尺(px/m)も同じ比率で更新する
  if (updateScale) {
    floors.forEach(f => {
      if (floorScale[f]) floorScale[f] = floorScale[f] * ratio;
    });
  }

  renderAll();
  renderScaleInfo();
  renderStatus(
    `倍率${Math.round(ratio * 100)}%・移動(${dx}, ${dy})を適用しました` +
    (includeZones && zoneCount ? `(規制エリア${zoneCount}件も変換)` : '') +
    (updateScale ? '(縮尺も更新)' : '') + '。Ctrl+Zで元に戻せます'
  );
}

function updateTransformInfo() {
  const el = document.getElementById('transformInfo');
  if (!el) return;
  const targets = getTransformTargets();
  const floors = [...new Set(targets.map(n => n.floor))];
  const sel = document.getElementById('transformAnchor');
  const mode = sel ? sel.value : 'centroid';
  const anchorLabel = mode === 'centroid' ? '基準:重心'
    : mode === 'origin' ? '基準:画像左上'
    : (transformAnchorPoint ? `基準:(${transformAnchorPoint.x}, ${transformAnchorPoint.y})` : '基準:未指定');
  const zonesEl = document.getElementById('transformZonesToggle');
  const includeZones = !zonesEl || zonesEl.checked;
  const zoneCount = includeZones ? zones.filter(z => floors.includes(z.floor)).length : 0;
  el.textContent = `対象 ${targets.length}ノード(${floors.map(f => floorLabels[f]).join('/') || '-'})` +
    (includeZones ? ` + 規制エリア${zoneCount}件` : '') + ` / ${anchorLabel}` +
    (transformPickMode ? ' ← 地図をクリック' : '');
}
