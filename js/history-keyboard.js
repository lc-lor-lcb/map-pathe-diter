/* ---------------- Undo ---------------- */

function pushHistory() {
  history.push(JSON.stringify({ nodes, edges, zones, floorScale }));
  if (history.length > 60) history.shift();
}
function undo() {
  if (!history.length) { renderStatus('これ以上は戻せません'); return; }
  const prev = JSON.parse(history.pop());
  nodes = prev.nodes; edges = prev.edges; zones = prev.zones;
  if (prev.floorScale) floorScale = prev.floorScale; // 旧履歴には無いので存在時のみ復元
  renderAll();
  renderScaleInfo();
  renderStatus('元に戻しました');
}

// 矢印キーでの連続移動を1回のUndo単位にまとめるための管理。
// キーを押しっぱなしにして何度もnudgeしても、Ctrl+Zは「動かす前」に1回で戻る。
let nudgeHistoryPushed = false;
let nudgeKeyupHandlerAttached = false;
let zoneNudgeHistoryPushed = false;
let zoneNudgeKeyupHandlerAttached = false;

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); undo(); return;
    }

    if (!typing && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      const hasNodeTarget = selectedNodeIds.length || selectedListNodeId;
      // 規制エリア移動モードで区画を選んでいるときは、その区画を動かす(Shiftで10px)
      if (!hasNodeTarget && zoneMoveMode && selectedZoneId) {
        const z = zones.find(zz => zz.id === selectedZoneId);
        if (!z) return;
        e.preventDefault();
        if (!zoneNudgeHistoryPushed) {
          pushHistory();
          zoneNudgeHistoryPushed = true;
        }
        const mult = e.shiftKey ? 10 : 1;
        const step = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] }[e.key];
        const vi = selectedZoneVertexIndex;
        const vertex = vi >= 0 ? z.points[vi] : null;
        if (vi >= 0 && !vertex) selectedZoneVertexIndex = -1;
        if (vertex) {
          vertex.x += step[0] * mult;
          vertex.y += step[1] * mult;
          renderAll();
          renderStatus(`区画「${z.label}」の頂点${vi + 1}を移動しました(${step[0] * mult}, ${step[1] * mult})`);
        } else {
          z.points = z.points.map(p => ({ x: p.x + step[0] * mult, y: p.y + step[1] * mult }));
          renderAll();
          renderStatus(`区画「${z.label}」を移動しました(${step[0] * mult}, ${step[1] * mult})`);
        }
        if (!zoneNudgeKeyupHandlerAttached) {
          zoneNudgeKeyupHandlerAttached = true;
          window.addEventListener('keyup', function onZoneNudgeKeyup(ev) {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)) {
              zoneNudgeHistoryPushed = false;
              zoneNudgeKeyupHandlerAttached = false;
              window.removeEventListener('keyup', onZoneNudgeKeyup);
            }
          });
        }
        return;
      }
      const hasTarget = hasNodeTarget;
      if (!hasTarget) return;
      e.preventDefault();
      if (!nudgeHistoryPushed) {
        pushHistory();
        nudgeHistoryPushed = true;
      }
      const step = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] }[e.key];
      nudgeSelectedNodes(step[0], step[1]);
      if (!nudgeKeyupHandlerAttached) {
        nudgeKeyupHandlerAttached = true;
        window.addEventListener('keyup', function onNudgeKeyup(ev) {
          if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)) {
            nudgeHistoryPushed = false;
            nudgeKeyupHandlerAttached = false;
            window.removeEventListener('keyup', onNudgeKeyup);
          }
        });
      }
      return;
    }

    if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (selectedNodeIds.length) {
        e.preventDefault();
        deleteSelectedNodes();
      } else if (selectedListNodeId) {
        e.preventDefault();
        const n = nodes.find(nn => nn.id === selectedListNodeId);
        const name = n ? n.name : selectedListNodeId;
        deleteNode(selectedListNodeId);
        selectedListNodeId = null;
        renderStatus(`ノード「${name}」を削除しました`);
      } else if (selectedEdgeId) {
        e.preventDefault();
        deleteEdge(selectedEdgeId);
        selectedEdgeId = null;
        renderStatus('エッジを削除しました');
      }
    }

    if (!typing && e.key === 'Escape') {
      if (midpointPickMode) {
        e.preventDefault();
        cancelMidpointMovePick();
        return;
      }
      if (zoneMoveMode) {
        e.preventDefault();
        if (selectedZoneVertexIndex >= 0) {
          selectedZoneVertexIndex = -1;
          renderOverlay();
          renderStatus('頂点の選択を解除しました');
        } else {
          toggleZoneMoveMode();
        }
        return;
      }
      if (transformPickMode) {
        e.preventDefault();
        transformPickMode = false;
        updateTransformInfo();
        renderOverlay();
        renderStatus('基準点の指定をキャンセルしました');
        return;
      }
      if (selectedNodeIds.length) { e.preventDefault(); clearMultiSelection(); renderStatus('選択を解除しました'); }
    }
  });
}