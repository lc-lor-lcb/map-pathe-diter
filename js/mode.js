/* ---------------- モード切替 ---------------- */

function setMode(m) {
  mode = m;
  ['modeNode','modeEdge','modeZone','modeRoute'].forEach(id => {
    document.getElementById(id).classList.toggle('active', id === 'mode' + m.charAt(0).toUpperCase() + m.slice(1));
  });
  selectedNodeId = null;
  previewPoint = null;
  if (m !== 'node') {
    selectedNodeIds = [];
    pendingAlignAxis = null;
  }
  document.getElementById('edgeOptions').style.display = m === 'edge' ? 'block' : 'none';
  document.getElementById('zoneOptions').style.display = m === 'zone' ? 'block' : 'none';
  document.getElementById('routeOptions').style.display = m === 'route' ? 'block' : 'none';

  const hints = {
    node: '画像をクリックするとノードを追加します。既存ノードはドラッグで位置を動かせます。',
    edge: 'ノードをクリックして接続開始→続けて次のノードをクリックすると数珠つなぎで接続されます(連鎖モード時)。同じノードを再クリックで選択解除。',
    zone: '画像上をクリックして区画の頂点を置いていきます(3点以上)。「区画を確定」でその区画内の通路をまとめて通行止め/解除できます。',
    route: '2つのノードを順にクリックすると、現在の通行設定で実際に繋がるか経路を計算して確認できます(体験者向け画面ではなく、作業中の確認用です)。',
  };
  document.getElementById('hintText').textContent = hints[m];

  if (m === 'route') {
    routeStart = null; routeEnd = null; routePath = null;
    updateRouteInfo();
  }

  renderOverlay();
  renderMultiSelectPanel();
  renderStatus();
}