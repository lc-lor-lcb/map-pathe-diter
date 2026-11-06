const svgNS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'campusMapEditorData_v4';

const defaultFloorOrder = ['floor_1F','floor_2F','floor_3F','floor_4F','floor_5F'];
const defaultFloorLabels = {floor_1F:'1F', floor_2F:'2F', floor_3F:'3F', floor_4F:'4F', floor_5F:'5F'};
let floorOrder = [...defaultFloorOrder];
let floorLabels = {...defaultFloorLabels};
let customImages = {};   // floorId -> data URL (画像インポートで追加/差し替えした画像)
let floorScale = {};     // floorId -> pixelsPerMeter (縮尺校正済みの階のみキーが存在)

let currentFloor = 'floor_1F';
let mode = 'node'; // node | edge | zone | route
let chainMode = true;
let crossFloorMode = false;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 32;   // 3200%。さらに拡大したい場合はここを増やす
let zoom = 1, panX = 0, panY = 0;
let isSpaceDown = false, isPanning = false;
let panStart = {x:0, y:0, panX:0, panY:0};

let nodes = [];
let edges = [];
let zones = [];
let nodeSeq = 1, edgeSeq = 1, zoneSeq = 1;

let selectedNodeId = null;      // edge/route mode: 選択中の起点ノード
let selectedListNodeId = null;  // サイドバー・単一選択・ドラッグ選択用
let selectedNodeIds = [];       // Ctrl/Cmd+クリックによる複数選択(整列・矢印キー移動で使用)
let selectedEdgeId = null;
let previewPoint = null;        // edge接続中のプレビュー線の先端
let currentZonePoints = [];     // 区画下書き中の頂点
let routeStart = null, routeEnd = null, routePath = null;
let nodeSearchTerm = '';
let history = [];
let dragState = null;
let calibrating = false;
let calibPoints = [];
let showLabels = true;

let transformAnchorPoint = null;  // 画像差し替え後の再位置合わせ: 基準点(クリック指定)
let transformPickMode = false;    // 基準点のクリック待ち

// 格子: 表示ONの間はノード追加・ドラッグ・区画頂点が格子点にスナップする
let gridVisible = false;
let gridSize = 20;                // 画像ピクセル単位

// 表示サイズ: ノード図形の倍率(1=標準)と、ノード名ラベルの文字サイズ(画像座標のpx)
let nodeScale = 1;
let labelFontSize = 11;
let rectSelectState = null;       // Shift+ドラッグの矩形選択中のみ値が入る

// 格子2マスの中点へノードを移動するモード
let midpointPickMode = false;
let midpointPickCells = [];       // クリックしたマス(中心座標)を最大2つ保持
let midpointTargetId = null;      // 移動するノード

// 規制エリア(区画)の移動モード
let zoneMoveMode = false;
let selectedZoneId = null;
let selectedZoneVertexIndex = -1;  // 選択中の区画頂点(個別編集用)

function snapPoint(x, y) {
  if (!gridVisible || !(gridSize > 0)) return { x, y };
  return {
    x: Math.round(Math.round(x / gridSize) * gridSize),
    y: Math.round(Math.round(y / gridSize) * gridSize),
  };
}

/**
 * 近くにある経路ノードを返す(画面上で約12px以内)。
 * 規制エリアの頂点をノード位置にぴったり合わせるために使う。
 */
function snapToNearbyNode(x, y, floorId) {
  const fl = floorId || currentFloor;
  const threshold = 12 / zoom;
  let best = null, bestD = threshold;
  nodes.forEach(n => {
    if (n.floor !== fl) return;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) { bestD = d; best = n; }
  });
  return best ? { x: best.x, y: best.y, node: best } : null;
}

const typeOptions = [
  {v:'branch', label:'分岐点'},
  {v:'room', label:'部屋(OCR/手入力)'},
  {v:'entrance', label:'出入口'},
  {v:'stairs', label:'階段/EV'},
  {v:'toilet', label:'トイレ'},
  {v:'exhibit', label:'展示場所'},
];
const colorMap = {branch:'#534AB7', room:'#185fa5', entrance:'#3B6D11', stairs:'#854F0B', toilet:'#0097A7', exhibit:'#D85A30'};