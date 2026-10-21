/* ---------------- 経路テスト(Dijkstra) ---------------- */

function buildGraph() {
  const adj = {};
  nodes.forEach(n => adj[n.id] = []);
  edges.forEach(ed => {
    if (ed.blocked) return;
    const a = nodes.find(n => n.id === ed.from);
    const b = nodes.find(n => n.id === ed.to);
    if (!a || !b) return;
    const w = ed.crossFloor ? 80 : Math.hypot(a.x - b.x, a.y - b.y);
    adj[a.id].push({ to: b.id, weight: w });
    adj[b.id].push({ to: a.id, weight: w });
  });
  return adj;
}
function computeRoute(startId, endId) {
  const adj = buildGraph();
  const dist = {}, prev = {}, visited = new Set();
  Object.keys(adj).forEach(id => dist[id] = Infinity);
  if (!(startId in dist)) return null;
  dist[startId] = 0;
  const pq = [[0, startId]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === endId) break;
    (adj[u] || []).forEach(edge => {
      const nd = d + edge.weight;
      if (nd < dist[edge.to]) { dist[edge.to] = nd; prev[edge.to] = u; pq.push([nd, edge.to]); }
    });
  }
  if (!(endId in dist) || dist[endId] === Infinity) return null;
  const path = [];
  let cur = endId;
  while (cur !== undefined) { path.unshift(cur); cur = prev[cur]; }
  return path;
}
function updateRouteInfo() {
  const el = document.getElementById('routeOptions');
  if (mode !== 'route') return;
  if (!routeStart) {
    el.textContent = 'スタートにしたいノードをクリックしてください(全階どこでもOK)。';
  } else if (!routeEnd) {
    el.textContent = `スタート: ${nodes.find(n=>n.id===routeStart)?.name || '?'} / ゴールをクリックしてください`;
  } else if (routePath) {
    const names = routePath.map(id => {
      const n = nodes.find(nn => nn.id === id);
      return n ? `${n.name}(${floorLabels[n.floor]})` : '?';
    });
    let text = `経路: ${names.join(' → ')}`;
    const segs = summarizeRouteDistance(routePath);
    if (segs.length) {
      const distText = segs.map(s => `${floorLabels[s.floor]}:${s.meters !== null ? '約' + Math.round(s.meters) + 'm' : '距離不明(未校正)'}`).join(' / ');
      text += `\n推定距離: ${distText}`;
    }
    el.textContent = text;
  } else {
    el.textContent = '経路が見つかりませんでした(通行止め設定またはノード未接続の可能性)。';
  }
}
