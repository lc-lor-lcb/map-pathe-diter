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

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); undo(); return;
    }

    if (!typing && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      const hasTarget = selectedNodeIds.length || selectedListNodeId;
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