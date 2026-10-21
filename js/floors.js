/* ---------------- 階の切り替え ---------------- */

function renderFloorTabs() {
  const tabWrap = document.getElementById('floorTabs');
  tabWrap.innerHTML = '';
  floorOrder.forEach(f => {
    const btn = document.createElement('button');
    btn.textContent = floorLabels[f];
    btn.onclick = () => switchFloor(f);
    btn.dataset.floor = f;
    tabWrap.appendChild(btn);
  });
}

function getImageSrc(floorId) {
  if (customImages[floorId]) return customImages[floorId];
  return 'data:image/png;base64,' + floorImages[floorId];
}

function switchFloor(f) {
  currentFloor = f;
  document.querySelectorAll('#floorTabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.floor === f);
  });
  const img = document.getElementById('floorImg');
  img.src = getImageSrc(f);
  img.onload = () => {
    document.getElementById('overlay').setAttribute('width', img.naturalWidth);
    document.getElementById('overlay').setAttribute('height', img.naturalHeight);
    document.getElementById('overlay').setAttribute('viewBox', `0 0 ${img.naturalWidth} ${img.naturalHeight}`);
    fitToViewport();
    renderOverlay();
  };
  currentZonePoints = [];
  renderScaleInfo();
  renderStatus();
}
