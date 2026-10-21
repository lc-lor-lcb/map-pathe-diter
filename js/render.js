/* ---------------- 描画: メイン ---------------- */

function renderAll() {
  renderOverlay();
  renderNodeList();
  renderEdgeList();
  renderZoneList();
  renderSummary();
  renderMultiSelectPanel();
  updateTransformInfo();
  autosave();
}

/**
 * 複数選択中(Ctrl/Cmd+クリックで2つ以上選択)のときだけ表示される、
 * 整列操作パネル。選択中ノードを一覧し、クリックした行を「整列の基準」にする。
 */
function renderMultiSelectPanel() {
  const panel = document.getElementById('multiSelectPanel');
  if (!panel) return;
  if (selectedNodeIds.length < 2) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  panel.innerHTML = '';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:bold;margin-bottom:4px;';
  title.textContent = pendingAlignAxis
    ? `${pendingAlignAxis === 'x' ? '縦整列' : '横整列'}: 基準にするノードをクリック`
    : `${selectedNodeIds.length}個のノードを選択中`;
  panel.appendChild(title);

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;';
  // 全選択時はチップが膨大になるため上限を設ける(整列の基準選択には十分)
  const MAX_CHIPS = 24;
  selectedNodeIds.slice(0, MAX_CHIPS).forEach(id => {
    const n = nodes.find(nn => nn.id === id);
    if (!n) return;
    const chip = document.createElement('button');
    chip.textContent = n.name;
    chip.style.cssText = 'font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid #b4b2a9;background:#fff;cursor:pointer;';
    chip.onclick = () => alignPickBase(id);
    list.appendChild(chip);
  });
  if (selectedNodeIds.length > MAX_CHIPS) {
    const more = document.createElement('span');
    more.textContent = `ほか${selectedNodeIds.length - MAX_CHIPS}個`;
    more.style.cssText = 'font-size:11px;padding:3px 8px;color:#5f5e5a;';
    list.appendChild(more);
  }
  panel.appendChild(list);

  const alignBtnRow = document.createElement('div');
  alignBtnRow.className = 'btn-row';
  const alignXBtn = document.createElement('button');
  alignXBtn.textContent = '縦整列(x座標を揃える)';
  alignXBtn.onclick = () => requestAlign('x');
  const alignYBtn = document.createElement('button');
  alignYBtn.textContent = '横整列(y座標を揃える)';
  alignYBtn.onclick = () => requestAlign('y');
  alignBtnRow.appendChild(alignXBtn); alignBtnRow.appendChild(alignYBtn);
  panel.appendChild(alignBtnRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'secondary';
  clearBtn.textContent = '選択解除(Esc)';
  clearBtn.onclick = () => { clearMultiSelection(); renderStatus('選択を解除しました'); };
  btnRow.appendChild(clearBtn);
  panel.appendChild(btnRow);
}

// 整列の基準ノードを選ぶ2段階UI: 「縦/横整列」ボタン押下→基準ノードのチップをクリック、の順で使う。
// pendingAlignAxis が null でない間は「基準ノード選択待ち」の状態。
let pendingAlignAxis = null;

function requestAlign(axis) {
  if (selectedNodeIds.length < 2) {
    renderStatus('整列するには2つ以上のノードを選択してください(Ctrl/Cmd+クリックで複数選択)');
    return;
  }
  pendingAlignAxis = axis;
  renderStatus(`${axis === 'x' ? '縦整列' : '横整列'}: 基準にするノードを、上のチップから1つクリックしてください`);
}

function alignPickBase(nodeId) {
  if (!pendingAlignAxis) return;
  alignSelectedNodes(pendingAlignAxis, nodeId);
  pendingAlignAxis = null;
}

function updatePreviewLine() {
  const svg = document.getElementById('overlay');
  const old = document.getElementById('previewLine');
  if (old) old.remove();
  if (mode !== 'edge' || !selectedNodeId || !previewPoint) return;
  const selNode = nodes.find(n => n.id === selectedNodeId);
  if (!selNode || selNode.floor !== currentFloor) return;
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('id', 'previewLine');
  line.setAttribute('x1', selNode.x); line.setAttribute('y1', selNode.y);
  line.setAttribute('x2', previewPoint.x); line.setAttribute('y2', previewPoint.y);
  line.setAttribute('stroke', '#185fa5');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-dasharray', '6 5');
  line.setAttribute('opacity', '0.7');
  svg.appendChild(line);
}

function renderOverlay() {
  const svg = document.getElementById('overlay');
  svg.innerHTML = '';
  const floorNodes = nodes.filter(n => n.floor === currentFloor);
  const floorNodeIds = new Set(floorNodes.map(n => n.id));

  // 規制エリア(区画)描画
  zones.filter(z => z.floor === currentFloor).forEach(z => {
    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', z.points.map(p => `${p.x},${p.y}`).join(' '));
    poly.setAttribute('fill', '#E24B4A');
    poly.setAttribute('fill-opacity', '0.14');
    poly.setAttribute('stroke', '#E24B4A');
    poly.setAttribute('stroke-width', '2.5');
    poly.setAttribute('stroke-dasharray', '8 5');
    svg.appendChild(poly);
    const cx = z.points.reduce((s,p)=>s+p.x,0) / z.points.length;
    const cy = z.points.reduce((s,p)=>s+p.y,0) / z.points.length;
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', cx); label.setAttribute('y', cy);
    label.setAttribute('font-size', '22'); label.setAttribute('fill', '#A32D2D');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('stroke', '#fff'); label.setAttribute('stroke-width', '3'); label.setAttribute('paint-order', 'stroke');
    label.textContent = z.label;
    svg.appendChild(label);
  });

  // 区画下書き中の頂点
  if (mode === 'zone' && currentZonePoints.length) {
    if (currentZonePoints.length > 1) {
      const poly = document.createElementNS(svgNS, 'polyline');
      poly.setAttribute('points', currentZonePoints.map(p => `${p.x},${p.y}`).join(' '));
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#E24B4A');
      poly.setAttribute('stroke-width', '3'); poly.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(poly);
    }
    currentZonePoints.forEach(p => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 6);
      c.setAttribute('fill', '#E24B4A');
      svg.appendChild(c);
    });
  }

  // 縮尺校正中の点
  if (calibrating && calibPoints.length) {
    calibPoints.forEach((p, i) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 7);
      c.setAttribute('fill', '#E8B830'); c.setAttribute('stroke', '#000'); c.setAttribute('stroke-width', '1.5');
      svg.appendChild(c);
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', p.x + 10); t.setAttribute('y', p.y - 10);
      t.setAttribute('font-size', '20'); t.setAttribute('fill', '#000');
      t.setAttribute('stroke', '#fff'); t.setAttribute('stroke-width', '3'); t.setAttribute('paint-order', 'stroke');
      t.textContent = String(i + 1);
      svg.appendChild(t);
    });
    if (calibPoints.length === 2) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', calibPoints[0].x); line.setAttribute('y1', calibPoints[0].y);
      line.setAttribute('x2', calibPoints[1].x); line.setAttribute('y2', calibPoints[1].y);
      line.setAttribute('stroke', '#E8B830'); line.setAttribute('stroke-width', '3'); line.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(line);
    }
  }

  // 再位置合わせの基準点(指定時のみ)
  if (transformAnchorPoint) {
    const ax = transformAnchorPoint.x, ay = transformAnchorPoint.y;
    const cross = document.createElementNS(svgNS, 'path');
    cross.setAttribute('d', `M${ax-12},${ay} L${ax+12},${ay} M${ax},${ay-12} L${ax},${ay+12}`);
    cross.setAttribute('stroke', '#1D9E75'); cross.setAttribute('stroke-width', '3');
    svg.appendChild(cross);
    const anchorRing = document.createElementNS(svgNS, 'circle');
    anchorRing.setAttribute('cx', ax); anchorRing.setAttribute('cy', ay); anchorRing.setAttribute('r', 8);
    anchorRing.setAttribute('fill', 'none'); anchorRing.setAttribute('stroke', '#1D9E75'); anchorRing.setAttribute('stroke-width', '2');
    svg.appendChild(anchorRing);
  }

  // 同一階内エッジ
  edges.filter(ed => floorNodeIds.has(ed.from) && floorNodeIds.has(ed.to)).forEach(ed => {
    const a = nodes.find(n => n.id === ed.from), b = nodes.find(n => n.id === ed.to);
    const isSel = selectedEdgeId === ed.id;

    if (isSel) {
      const halo = document.createElementNS(svgNS, 'line');
      halo.setAttribute('x1', a.x); halo.setAttribute('y1', a.y);
      halo.setAttribute('x2', b.x); halo.setAttribute('y2', b.y);
      halo.setAttribute('stroke', '#000');
      halo.setAttribute('stroke-width', '10');
      halo.setAttribute('stroke-linecap', 'round');
      svg.appendChild(halo);
    }

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', ed.blocked ? '#E24B4A' : '#1D9E75');
    line.setAttribute('stroke-width', isSel ? '6' : '4');
    line.setAttribute('stroke-dasharray', ed.blocked ? '10 6' : 'none');
    svg.appendChild(line);

    // クリック判定を広げるための見えない太い線(実際のクリックはこちらで受ける)
    const hit = document.createElementNS(svgNS, 'line');
    hit.setAttribute('x1', a.x); hit.setAttribute('y1', a.y);
    hit.setAttribute('x2', b.x); hit.setAttribute('y2', b.y);
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '16');
    hit.style.pointerEvents = 'all';
    hit.style.cursor = 'pointer';
    hit.addEventListener('click', (ev) => {
      // 区画下書き中・校正中はエッジ選択より頂点追加を優先:
      // stopPropagationせずimgwrapのクリック処理に流す
      if (mode === 'zone' || calibrating) return;
      ev.stopPropagation();
      selectedEdgeId = ed.id;
      selectedListNodeId = null;
      renderEdgeList();
      renderOverlay();
    });
    svg.appendChild(hit);
  });

  // 階またぎエッジの目印
  edges.filter(ed => ed.crossFloor && (floorNodeIds.has(ed.from) !== floorNodeIds.has(ed.to))).forEach(ed => {
    const localId = floorNodeIds.has(ed.from) ? ed.from : ed.to;
    const otherId = floorNodeIds.has(ed.from) ? ed.to : ed.from;
    const localNode = nodes.find(n => n.id === localId), otherNode = nodes.find(n => n.id === otherId);
    if (!localNode || !otherNode) return;
    const ring = document.createElementNS(svgNS, 'circle');
    ring.setAttribute('cx', localNode.x); ring.setAttribute('cy', localNode.y); ring.setAttribute('r', 22);
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', ed.blocked ? '#E24B4A' : '#854F0B');
    ring.setAttribute('stroke-width', '3'); ring.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(ring);
    const tag = document.createElementNS(svgNS, 'text');
    tag.setAttribute('x', localNode.x); tag.setAttribute('y', localNode.y - 28);
    tag.setAttribute('font-size', '18'); tag.setAttribute('fill', '#854F0B'); tag.setAttribute('text-anchor', 'middle');
    tag.setAttribute('stroke', '#fff'); tag.setAttribute('stroke-width', '3'); tag.setAttribute('paint-order', 'stroke');
    tag.textContent = `→${floorLabels[otherNode.floor]}:${otherNode.name}`;
    svg.appendChild(tag);
  });

  // 経路テスト結果のハイライト
  if (routePath) {
    for (let i = 0; i < routePath.length - 1; i++) {
      const a = nodes.find(n => n.id === routePath[i]), b = nodes.find(n => n.id === routePath[i+1]);
      if (a && b && a.floor === currentFloor && b.floor === currentFloor) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', '#E8B830'); line.setAttribute('stroke-width', '7'); line.setAttribute('opacity', '0.9');
        svg.appendChild(line);
      }
    }
  }

  // ノード本体
  floorNodes.forEach(n => {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'node-dot');
    g.style.pointerEvents = 'all';
    const isMultiSelected = selectedNodeIds.includes(n.id);
    const isSelected = selectedNodeId === n.id || selectedListNodeId === n.id || isMultiSelected || (mode==='route' && (routeStart===n.id || routeEnd===n.id));

    if (isMultiSelected) {
      const ring = document.createElementNS(svgNS, 'circle');
      ring.setAttribute('cx', n.x); ring.setAttribute('cy', n.y); ring.setAttribute('r', 11);
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#E8843A');
      ring.setAttribute('stroke-width', '2.5');
      g.appendChild(ring);
    }

    const shape = createNodeShapeEl(n, isSelected ? 7 : 5, isSelected);
    g.appendChild(shape);

    if (showLabels) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', n.x + 8); label.setAttribute('y', n.y + 5);
      label.setAttribute('font-size', '11'); label.setAttribute('fill', '#000');
      label.setAttribute('stroke', '#fff'); label.setAttribute('stroke-width', '3'); label.setAttribute('paint-order', 'stroke');
      label.textContent = n.name;
      g.appendChild(label);
    }

    if (mode === 'route' && routeStart === n.id) {
      const tag = document.createElementNS(svgNS, 'text');
      tag.setAttribute('x', n.x); tag.setAttribute('y', n.y - 20);
      tag.setAttribute('font-size', '20'); tag.setAttribute('fill', '#1D9E75'); tag.setAttribute('text-anchor','middle');
      tag.setAttribute('stroke', '#fff'); tag.setAttribute('stroke-width', '3'); tag.setAttribute('paint-order', 'stroke');
      tag.textContent = 'スタート';
      g.appendChild(tag);
    }
    if (mode === 'route' && routeEnd === n.id) {
      const tag = document.createElementNS(svgNS, 'text');
      tag.setAttribute('x', n.x); tag.setAttribute('y', n.y - 20);
      tag.setAttribute('font-size', '20'); tag.setAttribute('fill', '#D85A30'); tag.setAttribute('text-anchor','middle');
      tag.setAttribute('stroke', '#fff'); tag.setAttribute('stroke-width', '3'); tag.setAttribute('paint-order', 'stroke');
      tag.textContent = 'ゴール';
      g.appendChild(tag);
    }

    g.addEventListener('mousedown', (ev) => {
      // 区画下書き中・校正中・基準点指定中はドラッグ開始せず、imgwrapのクリック処理に流す
      if (mode === 'zone' || calibrating || transformPickMode) return;
      ev.stopPropagation();
      if (mode === 'node') startNodeDrag(n, ev);
    });
    g.addEventListener('click', (ev) => {
      // 区画下書き中・校正中・基準点指定中は最優先処理に流し、stopPropagationしない
      if (mode === 'zone' || calibrating || transformPickMode) return;
      ev.stopPropagation();
      if (mode === 'edge' || mode === 'route') nodeClicked(n);
      // 'node'モードでのクリック選択は onNodeDragEnd 側(mousedown/mouseupベース)で処理する
    });
    svg.appendChild(g);
  });

  if (selectedNodeId && crossFloorMode && mode === 'edge') {
    const sel = nodes.find(n => n.id === selectedNodeId);
    if (sel && sel.floor !== currentFloor) {
      const note = document.createElementNS(svgNS, 'text');
      note.setAttribute('x', 20); note.setAttribute('y', 40);
      note.setAttribute('font-size', '24'); note.setAttribute('fill', '#185fa5');
      note.textContent = `${floorLabels[sel.floor]}の「${sel.name}」から接続先を選択中...`;
      svg.appendChild(note);
    }
  }
  updatePreviewLine();
  updateTransformInfo();
}

function renderSummary() {
  const counts = {};
  typeOptions.forEach(o => counts[o.v] = 0);
  nodes.forEach(n => counts[n.type] = (counts[n.type] || 0) + 1);
  document.getElementById('typeSummary').textContent = typeOptions.map(o => `${o.label}:${counts[o.v]||0}`).join(' / ');
}

function renderNodeList() {
  const ul = document.getElementById('nodelist');
  ul.innerHTML = '';
  document.getElementById('nodeCount').textContent = nodes.length;
  const term = nodeSearchTerm.trim().toLowerCase();
  const list = term ? nodes.filter(n => n.name.toLowerCase().includes(term) || n.id.toLowerCase().includes(term)) : nodes;

  list.forEach(n => {
    const li = document.createElement('li');
    if (n.id === selectedListNodeId || selectedNodeIds.includes(n.id)) li.classList.add('selected');

    const info = document.createElement('div');
    info.style.flex = '1';

    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = n.name; nameInput.style.marginBottom = '2px';
    nameInput.onchange = () => { n.name = nameInput.value; renderOverlay(); autosave(); };
    nameInput.onclick = (e) => e.stopPropagation();

    const typeSelect = document.createElement('select');
    typeOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.v; o.textContent = opt.label;
      if (n.type === opt.v) o.selected = true;
      typeSelect.appendChild(o);
    });
    typeSelect.onchange = () => { n.type = typeSelect.value; renderOverlay(); renderSummary(); autosave(); };
    typeSelect.onclick = (e) => e.stopPropagation();

    const floorTag = document.createElement('span');
    floorTag.className = 'tag'; floorTag.textContent = floorLabels[n.floor];

    info.appendChild(nameInput); info.appendChild(typeSelect); info.appendChild(floorTag);

    const delBtn = document.createElement('span');
    delBtn.className = 'del'; delBtn.textContent = '削除';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteNode(n.id); };

    li.appendChild(info); li.appendChild(delBtn);
    li.onclick = (e) => {
      if (n.floor !== currentFloor) switchFloor(n.floor);
      if (e.ctrlKey || e.metaKey) {
        const idx = selectedNodeIds.indexOf(n.id);
        if (idx === -1) selectedNodeIds.push(n.id); else selectedNodeIds.splice(idx, 1);
        selectedListNodeId = null;
      } else {
        selectedNodeIds = [];
        selectedListNodeId = n.id;
      }
      selectedEdgeId = null;
      renderNodeList();
      renderOverlay();
    };
    ul.appendChild(li);
  });
}

function renderEdgeList() {
  const ul = document.getElementById('edgelist');
  ul.innerHTML = '';
  document.getElementById('edgeCount').textContent = edges.length;
  edges.forEach(ed => {
    const a = nodes.find(n => n.id === ed.from), b = nodes.find(n => n.id === ed.to);
    if (!a || !b) return;
    const li = document.createElement('li');
    if (selectedEdgeId === ed.id) li.classList.add('selected');

    const label = document.createElement('span');
    label.textContent = `${a.name}(${floorLabels[a.floor]}) - ${b.name}(${floorLabels[b.floor]})`;
    if (ed.crossFloor) {
      const crossTag = document.createElement('span');
      crossTag.className = 'tag cross'; crossTag.textContent = '階またぎ';
      label.appendChild(crossTag);
    } else {
      const meters = pxToRealMeters(Math.hypot(a.x - b.x, a.y - b.y), a.floor);
      if (meters !== null) {
        const distTag = document.createElement('span');
        distTag.className = 'tag';
        distTag.textContent = `約${meters < 10 ? meters.toFixed(1) : Math.round(meters)}m`;
        label.appendChild(distTag);
      }
    }

    const right = document.createElement('div');
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = ed.blocked ? '通行止め中' : '通行可';
    toggleBtn.style.cssText = 'font-size:11px;margin-right:6px;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;background:' + (ed.blocked ? '#F7C1C1' : '#C0DD97');
    toggleBtn.onclick = (e) => { e.stopPropagation(); pushHistory(); ed.blocked = !ed.blocked; renderAll(); };

    const delBtn = document.createElement('span');
    delBtn.className = 'del'; delBtn.textContent = '削除'; delBtn.style.cursor = 'pointer';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteEdge(ed.id); };

    right.appendChild(toggleBtn); right.appendChild(delBtn);
    li.appendChild(label); li.appendChild(right);
    li.onclick = () => { selectedEdgeId = ed.id; selectedListNodeId = null; renderNodeList(); renderEdgeList(); renderOverlay(); };
    ul.appendChild(li);
  });
}

function renderZoneList() {
  const ul = document.getElementById('zonelist');
  ul.innerHTML = '';
  document.getElementById('zoneCount').textContent = zones.length;
  zones.forEach(z => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${z.label}(${floorLabels[z.floor]}, ${z.points.length}点)`;

    const right = document.createElement('div');
    const blockBtn = document.createElement('button');
    blockBtn.textContent = '通行止めにする';
    blockBtn.style.cssText = 'font-size:11px;margin-right:4px;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;background:#F7C1C1';
    blockBtn.onclick = (e) => { e.stopPropagation(); applyZoneBlock(z.id, true); };

    const releaseBtn = document.createElement('button');
    releaseBtn.textContent = '解除';
    releaseBtn.style.cssText = 'font-size:11px;margin-right:4px;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;background:#C0DD97';
    releaseBtn.onclick = (e) => { e.stopPropagation(); applyZoneBlock(z.id, false); };

    const delBtn = document.createElement('span');
    delBtn.className = 'del'; delBtn.textContent = '削除'; delBtn.style.cursor = 'pointer';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteZone(z.id); };

    right.appendChild(blockBtn); right.appendChild(releaseBtn); right.appendChild(delBtn);
    li.appendChild(label); li.appendChild(right);
    li.onclick = () => { if (z.floor !== currentFloor) switchFloor(z.floor); };
    ul.appendChild(li);
  });
}

function renderStatus(msg) {
  document.getElementById('status').textContent = msg || '準備完了';
}