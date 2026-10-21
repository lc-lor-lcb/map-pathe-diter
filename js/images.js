/* ---------------- 画像インポート ---------------- */

function isSvgFile(file) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
}

// バイト列を壊さずdata URL化する(日本語のパスやテキストを含むSVG対策)
function svgTextToDataUrl(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return 'data:image/svg+xml;base64,' + btoa(bin);
}

// width/height が無い(または%指定の)SVGは、viewBoxから実寸を補って
// img.naturalWidth で正しく縮尺計算できるようにする
function normalizeSvgSize(text) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch (e) { return text; }
  const svg = doc && doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || svg.querySelector('parsererror')) return text;

  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const vbOk = vb.length === 4 && vb.every(v => !isNaN(v)) && vb[2] > 0 && vb[3] > 0;
  if (!vbOk) return text;

  const w = svg.getAttribute('width');
  const h = svg.getAttribute('height');
  const needsFix = !w || !h || /%$/.test(w) || /%$/.test(h);
  if (!needsFix) return text;

  svg.setAttribute('width', String(vb[2]));
  svg.setAttribute('height', String(vb[3]));
  return new XMLSerializer().serializeToString(doc);
}

// SVGはテキストとして読み、それ以外は従来どおりreadAsDataURL
function readImageFile(file, onDone) {
  if (isSvgFile(file)) {
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result || '');
      try { text = normalizeSvgSize(text); } catch (e) { /* 失敗時はそのまま使う */ }
      onDone(svgTextToDataUrl(text));
    };
    reader.onerror = () => renderStatus('SVGの読み込みに失敗しました');
    reader.readAsText(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onDone(reader.result);
  reader.onerror = () => renderStatus('画像の読み込みに失敗しました');
  reader.readAsDataURL(file);
}

function handleImageImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  readImageFile(file, (dataUrl) => {
    const hint = document.getElementById('imageFormatHint');
    if (hint) hint.style.display = isSvgFile(file) ? 'block' : 'none';
    const replace = confirm(
      `この画像を「${floorLabels[currentFloor]}」の画像として置き換えますか？\n\n` +
      `OK: 現在表示中の階(${floorLabels[currentFloor]})を置き換える\n` +
      `キャンセル: 新しい階として追加する`
    );
    if (replace) {
      pushHistory();
      customImages[currentFloor] = dataUrl;
      delete floorScale[currentFloor]; // 画像が変わるので縮尺校正はリセット
      switchFloor(currentFloor);
      renderStatus(`${floorLabels[currentFloor]}の画像を差し替えました。縮尺は未校正の状態に戻ったので、必要なら再設定してください`);
    } else {
      const label = prompt('新しい階の名前を入力してください(例: 別館1F、地下1階など)', '新しい階');
      if (!label) { renderStatus('追加をキャンセルしました'); return; }
      pushHistory();
      const newId = 'custom_' + Date.now();
      floorOrder.push(newId);
      floorLabels[newId] = label;
      customImages[newId] = dataUrl;
      renderFloorTabs();
      switchFloor(newId);
      renderStatus(`新しい階「${label}」を追加しました。まだ縮尺は未校正です`);
    }
  });
}
