width = 900;
woff = 20;
height = 500;
hoff = 10;

var canvas = document.getElementById("dotPlotCanvas")
var ctx = canvas.getContext("2d");
canvas.height = height + hoff * 2;
canvas.width = width + woff * 2;

var delta = new DeltaParser("example-data/stago_lepto.delta");
var delta = new DeltaParser("example-data/yeasts.delta");
var refSeqs = delta.refs().sort(function(a,b) {return b.length - a.length;});
var qrySeqs = delta.qrys().sort(function(a,b) {return a.length - b.length;});

var refOffSets = {};
cumulativeRefLength = refSeqs.reduce(function(p,c,i,a) {
  refOffSets[c.name] = p;
  return p + c.length;
}, 0);
var qryOffSets = {};
cumulativeQryLength = qrySeqs.reduce(function(p,c,i,a) {
  qryOffSets[c.name] = p;
  return p + c.length;
}, 0);

refScaleFactor = width / cumulativeRefLength;
qryScaleFactor = height / cumulativeQryLength;

function scaleX(name, position) {
  return (Math.floor(refOffSets[name]) + position) * refScaleFactor;
}
function scaleY(name, position) {
  return (Math.floor(qryOffSets[name]) + position) * qryScaleFactor;
}

function drawGrid(c) {
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  c.strokeStyle = "rgba(90,90,90,0.15)";
  c.beginPath();

  for(var name in refOffSets) {
    var offset = scaleX(name, 0);
    c.moveTo(offset,0);
    c.lineTo(offset,height);
  }
  for (var name in qryOffSets) {
    var offset = scaleY(name, 0);
    c.moveTo(0,offset);
    c.lineTo(width,offset);
  }
  
  c.moveTo(Math.floor(cumulativeRefLength * refScaleFactor),0);
  c.lineTo(Math.floor(cumulativeRefLength * refScaleFactor),height);
  
  c.moveTo(0, Math.floor(cumulativeQryLength * qryScaleFactor));
  c.lineTo(width, Math.floor(cumulativeQryLength * qryScaleFactor));
  
  c.stroke();
  c.restore();
}

function drawHits(c) {
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  
  delta.hits.forEach(function(hit) {
    c.beginPath();
    c.moveTo(scaleX(hit.rname,hit.rstart) - 0.25, scaleY(hit.qname, hit.qstart) - 0.25);
    c.lineTo(scaleX(hit.rname,hit.rend) + 0.25 , scaleY(hit.qname, hit.qend) + 0.25);
    c.strokeStyle = hit.qend > hit.qstart ? "blue" : "red";
    c.stroke();
  });
  
  c.restore();
}

function clipPaths(c) {
  c.beginPath();
  c.rect(woff, hoff, width + 0.5, height + 0.5);
  c.clip();
}

function getCursorPosition(e) {
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left - woff - 1;
  var y = e.clientY - rect.top - hoff - 1;
  return {x:x,y:y};
}

function mouseTest(e) {
  var mousePos = getCursorPosition(e);
  console.log(mousePos);
}

clipPaths(ctx);
drawGrid(ctx);
drawHits(ctx);

canvas.addEventListener("mousemove", mouseTest, false);