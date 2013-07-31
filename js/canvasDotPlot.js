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
var delta = new DeltaParser("example-data/yeasts.delta");
var refSeqs = delta.refs().sort(function(a,b) {return b.length - a.length;});
var qrySeqs = delta.qrys().sort(function(a,b) {return b.length - a.length;});

var refOffSets = {};
var qryOffSets = {};
var cumulativeRefLength = refSeqs.reduce(function(p,c,i,a) {
  refOffSets[c.name] = p;
  return p + c.length;
}, 0);
refOffSets["final"] = cumulativeRefLength;
var cumulativeQryLength = qrySeqs.reduce(function(p,c,i,a) {
  qryOffSets[c.name] = p;
  return p + c.length;
}, 0);
qryOffSets["final"] = cumulativeQryLength;


var requestAnimationFrame =  
        window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame || window.msRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        function(callback) {
          return setTimeout(callback, 1);
        };

function ViewExtents(x,y,w,h) {
  this.x = x;
  this.y = y;
  this.width = w;
  this.height = h;
}

var currentViewExtents = new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength)
var viewStack = [new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength),new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength)];
var AnimLengthIn = 10;
var AnimLengthOut = 5;
var animationCountDown = 0;

var zoomout = function() {
  if(animationCountDown < 0) {viewStack.shift();return true;}
  var animFrac = animationCountDown--/AnimLengthOut;
  var easedFrac = d3.ease('cubic')(1 - animFrac);
  render(easedFrac);
}
var zoomin = function() {
  if(animationCountDown < 0) {return true;}
  var animFrac = animationCountDown--/AnimLengthIn;
  var easedFrac = d3.ease('cubic')(animFrac);
  render(easedFrac);
}

var render = function(easedFrac) {  
  currentViewExtents.x = d3.interpolate(viewStack[0].x,viewStack[1].x)(easedFrac);
  currentViewExtents.y = d3.interpolate(viewStack[0].y,viewStack[1].y)(easedFrac);
  currentViewExtents.width = d3.interpolate(viewStack[0].width,viewStack[1].width)(easedFrac);
  currentViewExtents.height = d3.interpolate(viewStack[0].height,viewStack[1].height)(easedFrac);
  
  refScaleFactor = width / currentViewExtents.width;
  qryScaleFactor = height / currentViewExtents.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx);
  drawHits(ctx);
  selectedRegions.update(overlayCtx);
  return false;
}

clipPaths(ctx);
clipPaths(overlayCtx);

refScaleFactor = width / currentViewExtents.width;
qryScaleFactor = height / currentViewExtents.height;
ctx.clearRect(0, 0, canvas.width, canvas.height);
drawGrid(ctx);
drawHits(ctx);

d3.timer(zoomin);
  
function scaleX(name, position) {
  return Math.floor((refOffSets[name] + position - currentViewExtents.x) * refScaleFactor);
};

function scaleY(name, position) {
    return Math.floor(height - (qryOffSets[name] + position - currentViewExtents.y) * qryScaleFactor);
}

function drawGrid(c) {
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  c.strokeStyle = "rgba(90,90,90,0.1)";
  c.beginPath();
  
  var zeroX = currentViewExtents.x * refScaleFactor * -1;
  var zeroY = height - (cumulativeQryLength - currentViewExtents.y) * qryScaleFactor;
  
  var maxX = width - (currentViewExtents.x + currentViewExtents.width - cumulativeRefLength) * refScaleFactor;
  var maxY = height + currentViewExtents.y * qryScaleFactor;
  
  for(var name in refOffSets) {
    var offset = scaleX(name, 0);
    c.moveTo(offset,zeroY);
    c.lineTo(offset,maxY);
  }
  for (var name in qryOffSets) {
    var offset = scaleY(name, 0);
    c.moveTo(zeroX,offset);
    c.lineTo(maxX,offset);
  }
  
  c.moveTo(maxX, zeroY);
  c.lineTo(maxX, height);
  
  c.moveTo(zeroX, maxY);
  c.lineTo(maxX, maxY);
  
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

function getRefName(xPos) {
  var refName;
  var refStart;
  // Switch to base pair coords
  xPos = xPos / refScaleFactor + currentViewExtents.x;
  if(xPos < 0 || xPos > cumulativeRefLength) {
    return ;
  }
  for(var name in refOffSets) {
    var oldName = refName;
    var oldStart = refStart;
    refName = name;
    refStart = refOffSets[name];
    if(refStart > xPos) {
      return {name: oldName, x: oldStart, width: refStart - oldStart};
    }
  }
  return {name: refName, x: refStart, width: cumulativeRefLength - refStart};
}

function getQryName(yPos) {
  var qryName;
  var qryStart;
  var oldName;
  var oldStart = 0;
  // Switch to base pair coords
  yPos = (height - yPos) / qryScaleFactor + currentViewExtents.y;
  if(yPos < 0 || yPos > cumulativeQryLength) {
    return ;
  }
  for(var name in qryOffSets) {
    oldName = qryName;
    oldStart = qryStart;
    qryName = name;
    qryStart = qryOffSets[name];
    if(qryStart > yPos) {
      return {name: oldName, y: oldStart, height: qryStart - oldStart};
    }
  }
  return {name: qryName, y: qryStart, height: cumulativeQryLength - qryStart};
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
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.fillStyle = "rgba(90,90,90,0.075)";
  overlayCtx.strokeStyle = "rgba(0,0,0,0.5)";
  overlayCtx.lineWidth = 1;
  this.regions.forEach(function(r) {
    var x = scaleX(r.refName, 0);
    var y = scaleY(r.qryName, 0);
    var w = r.width * refScaleFactor;
    var h = r.height * qryScaleFactor * -1;
    overlayCtx.fillRect(x,y,w,h);
    overlayCtx.strokeRect(x,y,w,h);
  })
  c.restore();
}

function mouseDownListener(e) {
  var mousePos = getCursorPosition(e);
  dragging = true;
  drag = {};
  drag.x = mousePos.x;
  drag.y = mousePos.y;
}

function mouseMoveListener(e) {
  if(dragging) {
    drag.moved = true;
    //var mousePos = getCursorPosition(e);
    
  } else {
    var mousePos = getCursorPosition(e);
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
    selectedRegions.update(overlayCtx);
    if(ref && qry) {
      var x = scaleX(ref.name, 0) + woff;
      var y = scaleY(qry.name, 0) + hoff;
      var w = ref.width * refScaleFactor;
      var h = qry.height * qryScaleFactor * -1;
      overlayCtx.fillStyle = "rgba(90,90,90,0.075)";
      overlayCtx.fillRect(x,y,w,h);
    }
  }
}

function mouseUpListener(e) {
  var mousePos = getCursorPosition(e);
  if(e.button == 0) {
    // Clicking on a box.
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
    selectedRegions.toggleBox(ref.x, qry.y, ref.width, qry.height, ref.name, qry.name);
  } else if (e.button == 1) {
    // Initiate zoom
    animationCountDown = AnimLengthIn;
    var x = viewStack[0].x + Math.min(drag.x, mousePos.x) / refScaleFactor;
    var w = Math.abs(mousePos.x - drag.x) / refScaleFactor;
    var y = viewStack[0].y + (height - Math.max(drag.y, mousePos.y)) / qryScaleFactor;
    var h = Math.abs(mousePos.y - drag.y) / qryScaleFactor;
    viewStack.unshift(new ViewExtents(x,y,w,h));
    d3.timer(zoomin);
  }
  selectedRegions.update(overlayCtx);
  dragging = false;
}

var selectedRegions = new SelectedSet();
var dragging = false;
var drag = {};

canvas.addEventListener("mousemove", mouseMoveListener);
canvas.addEventListener("mousedown", mouseDownListener);
canvas.addEventListener("mouseup", mouseUpListener);
document.body.addEventListener('keyup', function(e) {
  if(e.which == 80 && viewStack.length > 1) {
    // Initiate zoom
    console.log(viewStack);
    animationCountDown = AnimLengthOut;
    d3.timer(zoomout);
  }
});
