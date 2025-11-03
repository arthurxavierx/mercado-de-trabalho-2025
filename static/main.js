let barcodeDetector;
let channel;
let itemCount = 0;
let lastBarcode;
let subtotal = 0;

const BRL = Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DECODE_INTERVAL = 180;

const $age = document.getElementById('age');
const $barcode = document.getElementById('barcode');
const $body = document.querySelector('body');
const $camera = document.getElementById('camera');
const $html = $body.parentElement;
const $overlay = document.getElementById('overlay');
const $log = document.getElementById('log').querySelector('tbody');
const $main = document.getElementById('main');
const $name = document.getElementById('name');
const $open = document.getElementById('open');
const $profession = document.getElementById('profession');
const $scroll = document.getElementById('scroll');
const $start = document.getElementById('start');
const $subtotal = document.getElementById('subtotal');

async function start() {
  async function requestFullscreen() {
    const $document = window.document.documentElement;
    const requestFullscreen = $document.requestFullscreen || $document.mozRequestFullScreen || $document.webkitRequestFullScreen || $document.msRequestFullscreen;
    requestFullscreen.call($document, { navigationUI: 'hide' });
  }

  if (window.location.hash === '#debug') {
    $body.classList.add('debug');
  }
  else {
    await requestFullscreen();
  }

  channel = new DataChannel();
  channel.onopen = onChannelOpen;
  channel.onmessage = onChannelMessage;
  await channel.connect();
}

async function onChannelOpen() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  $camera.srcObject = stream;
  $start.style.display = 'none';
  $main.style.display = '';
  $open.style.display = '';
}

async function onChannelMessage(event) {
  console.log(event);
  const data = JSON.parse(event.data);
  const price = Math.random() * 99.9 + 0.01;

  $barcode.innerHTML = data.barcode;
  $name.innerHTML = data.name;
  $age.innerHTML = data.age;
  $profession.innerHTML = data.profession;

  const $row = $log.insertRow();
  $row.insertCell().innerHTML = ++itemCount;
  $row.insertCell().innerHTML = data.barcode;
  $row.insertCell().innerHTML = data.name;
  $row.insertCell().innerHTML = data.age;
  $row.insertCell().innerHTML = data.profession;
  $row.insertCell().innerHTML = BRL.format(price);
  $scroll.scrollTop = $scroll.scrollHeight;

  subtotal += price;
  $subtotal.innerHTML = BRL.format(subtotal);

  if (data.velocity > 1) {
    $body.style.background = 'white';
    $html.style.filter = 'grayscale(1) invert(1)';
    setTimeout(() => {
      $body.style.background = '';
      $html.style.filter = '';
    }, 100);
  }
}

async function play() {
  $overlay.setAttribute('viewBox', `0 0 ${$camera.videoWidth} ${$camera.videoHeight}`);
  decode();
}

async function decode() {
  try {
    const barcodes = await barcodeDetector.detect($camera);
    if (barcodes.length === 0) {
      lastBarcode = null;
      return;
    }

    const barcode = barcodes[0];
    if (!!lastBarcode && barcode.rawValue === lastBarcode.rawValue) return;
    channel.send(`${barcode.format} ${barcode.rawValue}`);
    lastBarcode = barcode;

    drawOverlay(barcode);
  }
  finally {
    setTimeout(decode, DECODE_INTERVAL);
  }
}

function drawOverlay(barcode) {
  $overlay.innerHTML = '';

  const corners = barcode.cornerPoints;
  const points = `${corners[0].x},${corners[0].y} ${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${corners[3].x},${corners[3].y}`;
  const polygon = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('class', 'barcode-polygon');
  $overlay.append(polygon);

  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.innerHTML = barcode.rawValue;
  text.setAttribute('x', corners[1].x);
  text.setAttribute('y', corners[1].y);
  text.setAttribute('fill', 'red');
  text.setAttribute('fontSize', '20');
  $overlay.append(text);
}

//

$start.onclick = start;
$camera.onloadeddata = play;
$subtotal.innerHTML = BRL.format(subtotal);

(async function initBarcodeDetector() {
  if (!('BarcodeDetector' in window)) {
    return alert('Barcode Detector is not supported by this browser.');
  }

  let formats = await window.BarcodeDetector.getSupportedFormats();
  if (formats.length > 0) {
    return barcodeDetector = new window.BarcodeDetector;
  }
})();
