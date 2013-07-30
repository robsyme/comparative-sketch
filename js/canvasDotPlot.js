width = 900;
woff = 20;
height = 500;
hoff = 20;

var overlay = document.getElementById("dotPlotOverlay")
var overlayCtx = overlay.getContext("2d");
var canvas = document.getElementById("dotPlotCanvas")
var ctx = canvas.getContext("2d");
canvas.height = height + hoff * 2;
overlay.height = height + hoff * 2;
canvas.width = width + woff * 2;
overlay.width = width + woff * 2;

var delta = new DeltaParser("example-data/stago_lepto.delta");
//var delta = new DeltaParser("example-data/yeasts.delta");
var refSeqs = delta.refs().sort(function(a,b) {return b.length - a.length;});
var qrySeqs = delta.qrys().sort(function(a,b) {return a.length - b.length;});


var refOffSets = {};
var qryOffSets = {};
var cumulativeRefLength = refSeqs.reduce(function(p,c,i,a) {
  refOffSets[c.name] = p;
  return p + c.length;
}, 0);
var cumulativeQryLength = qrySeqs.reduce(function(p,c,i,a) {
  qryOffSets[c.name] = p;
  return p + c.length;
}, 0);

refScaleFactor = width / cumulativeRefLength;
qryScaleFactor = height / cumulativeQryLength;

function scaleX(name, position) {
  return Math.floor((refOffSets[name] + position) * refScaleFactor);
}
function scaleY(name, position) {
  return Math.floor((qryOffSets[name] + position) * qryScaleFactor);
}

function drawGrid(c) {
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  c.strokeStyle = "rgba(90,90,90,0.1)";
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
  
  var x = Math.floor(cumulativeRefLength * refScaleFactor)
  var y = Math.floor(cumulativeQryLength * qryScaleFactor)
  
  c.moveTo(x, 0);
  c.lineTo(x, height);
  
  c.moveTo(0, y);
  c.lineTo(width, y);
  
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
//    c.strokeStyle = hit.qend > hit.qstart ? "rgb(103, 169, 207)" : "rgb(239, 138, 98)";
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

function getRefName(xPos) {
  var refName;
  var refStart;
  if(xPos < 0 || xPos > cumulativeRefLength * refScaleFactor) {
    return ;
  }
  for(var name in refOffSets) {
    var oldName = refName;
    var oldStart = refStart;
    refName = name;
    refStart = scaleX(name, 0);
    if(refStart > xPos) {
      return {name: oldName, x: oldStart, width: refStart - oldStart};
    }
  }
  return {name: refName, x: refStart, width: cumulativeRefLength * refScaleFactor - refStart};
}

function getQryName(yPos) {
  var qryName;
  var qryStart;
  var oldName;
  var oldStart = 0;
  if(yPos < 0 || yPos > cumulativeQryLength * qryScaleFactor) {
    return ;
  }
  for(var name in qryOffSets) {
    oldName = qryName;
    oldStart = qryStart;
    qryName = name;
    qryStart = scaleY(name, 0);
    if(qryStart > yPos) {
      return {name: oldName, y: oldStart, height: qryStart - oldStart};
    }
  }
  return {name: qryName, y: qryStart, height: cumulativeQryLength * qryScaleFactor - qryStart};
}

function mouseMoveListener(e) {
  if(dragging) {
    //overlay.width = width + woff * 2;
    var mousePos = getCursorPosition(e);
    drag.moved = true;
    console.log("DRAG");
  } else {
    var mousePos = getCursorPosition(e);
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
    selectedRegions.update(overlayCtx);
    if(ref && qry) {
      var x = scaleX(ref.name, 0) + woff;
      var y = scaleY(qry.name, 0) + hoff;
      var w = ref.width;
      var h = qry.height;
      overlayCtx.fillStyle = "rgba(90,90,90,0.075)";
      overlayCtx.fillRect(x,y,w,h);
    }
  }
}

function SelectedSet() {
  this.regions = []
}

SelectedSet.prototype.addBox = function(x,y,w,h,refName, qryName){
  this.regions.push({x:x, y:y, width:w, height:h, refName:refName, qryName:qryName});
}

SelectedSet.prototype.removeBox = function(x,y) {
  this.regions = this.regions.filter(function(box) {
    return !(box.x == x && box.y == y); 
  })
}

SelectedSet.prototype.toggleBox = function(x,y,w,h,refName,qryName) {
  var present = this.regions.some(function(box, i, a) {
    return box.x == x && box.y == y; 
  })
  
  if(present) {
    this.removeBox(x,y);
  } else {
    this.addBox(x,y,w,h,refName, qryName);
  }
}
SelectedSet.prototype.update = function(c) {
  overlay.width = width + woff * 2;
    overlayCtx.fillStyle = "rgba(90,90,90,0.075)";
  overlayCtx.strokeStyle = "rgba(0,0,0,0.5)";
  overlayCtx.lineWidth = 1;
  this.regions.forEach(function(r) {
    var x = scaleX(r.refName, 0) + woff + 0.5;
    var y = scaleY(r.qryName, 0) + hoff + 0.5;
    var w = r.width;
    var h = r.height;
    overlayCtx.fillRect(x,y,w,h);
    overlayCtx.strokeRect(x,y,w,h);
  })
}

function mouseDownListener(e) {
  var mousePos = getCursorPosition(e);
  console.log("DRAG START: ("  + mousePos.x + "," + mousePos.y + ")");
  dragging = true;
  drag = {};
  drag.x = mousePos.x;
  drag.y = mousePos.y;
}

function mouseUpListener(e) {
  var mousePos = getCursorPosition(e);
  if(!drag.moved) {
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
    selectedRegions.toggleBox(ref.x, qry.y, ref.width, qry.height, ref.name, qry.name);
  }
  selectedRegions.update(overlayCtx);
  console.log("DRAG END: ("  + mousePos.x + "," + mousePos.y + ")");
  dragging = false;
}

function zoomPlot(xstart, xend, ystart, yend) {
  
}

var selectedRegions = new SelectedSet();
var dragging = false;
var drag = {};

canvas.addEventListener("mousemove", mouseMoveListener);
canvas.addEventListener("mousedown", mouseDownListener);
canvas.addEventListener("mouseup", mouseUpListener);

clipPaths(ctx);
drawGrid(ctx);
drawHits(ctx);