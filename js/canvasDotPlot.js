width = 900;
woff = 20;
height = 500;
hoff = 20;

// Create two canvas contexts - one to plot the matches (often static),
//  and one that we'll redraw whenever the mouse moves. The dotplot canvas
//  draws thousands of hits, so I want to minimise the number of times
//  that gets redrawn.
var overlay = document.getElementById("dotPlotOverlay")
var overlayCtx = overlay.getContext("2d");
var canvas = document.getElementById("dotPlotCanvas")
var ctx = canvas.getContext("2d");
canvas.height = height + hoff * 2;
overlay.height = height + hoff * 2;
canvas.width = width + woff * 2;
overlay.width = width + woff * 2;

// Open the delta file and parse the hits.
var delta = new DeltaParser("example-data/stago_lepto.delta");
var delta = new DeltaParser("example-data/yeasts.delta");
var refSeqs = delta.refs().sort(function(a,b) {return b.length - a.length;});
var qrySeqs = delta.qrys().sort(function(a,b) {return b.length - a.length;});

// Create an index of where each sequence starts (in bp)
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

// Colour in between the lines.
clipPaths(ctx);
clipPaths(overlayCtx);

// Set up the stack with two ViewExtents that hold the whole plot.
var currentViewExtents = new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength)
var viewStack = [new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength),new ViewExtents(0,0,cumulativeRefLength,cumulativeQryLength)];

// Set up the initial scale factors to convert base space to coords.
refScaleFactor = width / currentViewExtents.width;
qryScaleFactor = height / currentViewExtents.height;
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Draw the first grid.
drawGrid(ctx);
drawHits(ctx);

// I keep a stack of ViewExtents objects that can moved up and down (like mummerplot)
//  The ViewExtents object keeps track of which part of the figure is drawn.
function ViewExtents(x,y,w,h) {
  this.x = x;
  this.y = y;
  this.width = w;
  this.height = h;
}

// Animate to the second ViewExtents in the stack. Shift the first ViewExtents off the stack when done. 
var zoomout = function(duration) {
  var start = new Date().getTime();
  var end = start + duration;
  var step = function() {
    var timestamp = new Date().getTime();
    var progress = Math.min((duration - (end - timestamp)) / duration, 1);
    var easedFrac = d3.ease('exp')(progress);
    render(easedFrac);
    if(progress < 1) {
      return false;
    } else {
      viewStack.shift();
      return true;
    }
    return (progress < 1) ? false : true;
  }
  d3.timer(step);
}

// Zoom in from the currentViewExtents to the one at the top of the stack.
var zoomin = function(duration) {
  var start = new Date().getTime();
  var end = start + duration;
  var step = function() {
    var timestamp = new Date().getTime();
    var progress = Math.min((duration - (end - timestamp)) / duration, 1);
    var easedFrac = d3.ease('sin')(progress);
    render(1 - easedFrac);
    return (progress < 1) ? false : true;
  }
  d3.timer(step);
}

// Re-render the current dotplot using the currentViewExtents.
  function render(easedFrac) {  
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

// Converts a base position into a pixel coordinate.
function scaleX(name, position) {
  return Math.floor((refOffSets[name] + position - currentViewExtents.x) * refScaleFactor);
};
function scaleY(name, position) {
    return Math.floor(height - (qryOffSets[name] + position - currentViewExtents.y) * qryScaleFactor);
}

// Draw the grid lines that mark where sequences start and end.
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

// Draw each of the hits.
function drawHits(c) {
  
  if(plotInColour) {
    var colour = d3.scale
    .linear()
    .domain([-1, -0.5, 0, 0.5, 1])
    .range(["#762a83", "#af8dc3", "#f7f7f7", "#7fbf7b", "#1b7837"])
    //.range(["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"])
    //.range(["#d73027", "#fc8d59", "#ffffbf", "#91bfdb", "#4575b4"])
  }
  
  c.save();
  c.translate(woff + 0.5, hoff + 0.5);
  
  delta.hits.forEach(function(hit) {
    c.beginPath();
    c.moveTo(scaleX(hit.rname,hit.rstart) - 0.25, scaleY(hit.qname, hit.qstart) - 0.25);
    c.lineTo(scaleX(hit.rname,hit.rend) + 0.25 , scaleY(hit.qname, hit.qend) + 0.25);
    var orientation = hit.qend > hit.qstart ? 1 : -1;
    if(plotInColour) {
      c.strokeStyle = colour(hit.similarity * orientation).toString();
    } else {
      c.strokeStyle = hit.qend > hit.qstart ? "blue" : "red";
    }
    c.stroke();
  });
  
  c.restore();
}

// Clip the given context to the basic rect of width and height (with offset)
function clipPaths(c) {
  c.beginPath();
  c.rect(woff, hoff, width + 0.5, height + 0.5);
  c.clip();
}

// Given a mouse event, it returns the xy position relative to the basic rect (including offsets).
function getCursorPosition(e) {
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left - woff - 1;
  var y = e.clientY - rect.top - hoff - 1;
  return {x:x,y:y};
}

// What is the reference sequence under the given x coordinate?
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

// What is the query sequence under the given y coordinate?
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

// Some scrappy OO javascript to hold the names of the currently selected sequences.
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
// On the given canvas, draws a border around each of the selected regions.
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

// Initiate a drag event.
function mouseDownListener(e) {
  var mousePos = getCursorPosition(e);
  dragging = true;
  drag = {};
  drag.x = mousePos.x;
  drag.y = mousePos.y;
}

// Draws a light highlight of the drag rect.
function drawDrag(x1, y1, x2, y2) {
  overlayCtx.fillRect(x1 + woff, y1 + hoff, x2 - x1, y2 - y1);
}

// If the mouse is moving, update the drag box if we're dragging, otherwise
//  highlight the sequence underneath the mouse.
function mouseMoveListener(e) {
  var mousePos = getCursorPosition(e);
  selectedRegions.update(overlayCtx);
  if(dragging) {
    drag.moved = true;
    drawDrag(drag.x, drag.y, mousePos.x, mousePos.y);
  } else {
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
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

// If we're just selecting a region, add it to the selectedRegions set, otherwise
//  we're probably zooming, so initiate a zoomin.
function mouseUpListener(e) {
  var mousePos = getCursorPosition(e);
  if(e.button == 0) {
    // Clicking on a box.
    var ref = getRefName(mousePos.x);
    var qry = getQryName(mousePos.y);
    selectedRegions.toggleBox(ref.x, qry.y, ref.width, qry.height, ref.name, qry.name);
  } else if (e.button == 1) {
    // Initiate zoom
    var x = viewStack[0].x + Math.min(drag.x, mousePos.x) / refScaleFactor;
    var w = Math.abs(mousePos.x - drag.x) / refScaleFactor;
    var y = viewStack[0].y + (height - Math.max(drag.y, mousePos.y)) / qryScaleFactor;
    var h = Math.abs(mousePos.y - drag.y) / qryScaleFactor;
    viewStack.unshift(new ViewExtents(x,y,w,h));
    zoomin(200);
  }
  selectedRegions.update(overlayCtx);
  dragging = false;
}

var selectedRegions = new SelectedSet();
var dragging = false;
var drag = {};
var plotInColour = false

canvas.addEventListener("mousemove", mouseMoveListener);
canvas.addEventListener("mousedown", mouseDownListener);
// Zoom out to previous viewExtents when 'p' is pressed.
canvas.addEventListener("mouseup", mouseUpListener);
document.body.addEventListener('keyup', function(e) {
  switch (e.which) {
    case 67:
    plotInColour = plotInColour ? false : true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx);
    drawHits(ctx);
    break;
    case 66:
    if(viewStack.length > 1) {
      zoomout(100);
    }
  }
});
