// Read in the data.
//   'refSeqs' and 'qrySeqs' are arrays of objects. Each objects has two properties, name and length.
//   the 'hits' variable is a large array each containing a 'Hit' object that looks like:
//   Hit
//     orientation: true
//     qend: 1192
//     qname: "gi|323334821|gb|ADVS01000001.1|"
//     qstart: 2
//     rend: 13929
//     rname: "ref|NC_0011
var delta = new DeltaParser("example-data/yeasts.delta");
var refSeqs = delta.refs().sort(function(a,b) {return b.length - a.length;});
var qrySeqs = delta.qrys().sort(function(a,b) {return a.length - b.length;});
var hits = delta.hits;

// Functions to Reduce the data into a more convenient form.
// These three functions are used by crossfilter to produce
//   the var "byNamesGrp", which is an array of objects like:
// 
//Object
//  key: Array[2]
//    0: "ref|NC_001142|"
//    1: "gi|323332921|gb|ADVS01000032.1|"
//  value: Array[17]
//    0: Object
//      boxHeight: 26.728934834119382
//      qend: 125317
//      qstart: 28387
//      rend: 121170
//      rstart: 24352
//    1: Object ...
//    2: Object ...
function reduceInitial() {
    return [];
}

function reduceAdd(p,v) {
    p.push({rstart: v.rstart, rend: v.rend, qstart: v.qstart, qend: v.qend});
    return p;
}

function reduceRemove(p,v) {
    return p.filter(function(m) {
        var refMatch = v.rstart == m.rstart;
        var qryMatch = v.qstart == m.qstart;
        return refMatch && qryMatch;
    })
}

// Make the byNamesGrp object. This is used to create a svg group for each pair of sequences.
var cf = crossfilter(delta.hits);
var byNamesDim = cf.dimension(function(d) {return [d.rname, d.qname];});
var byNamesGrp = byNamesDim.group();
byNamesGrp.reduce(reduceAdd,reduceRemove,reduceInitial);

// The w and h properties refer to the width and height of the plot area, not the whole SVG.
var woff = 150,
    hoff = 10,
    w = 800,
    h = 600,
    xLabOffset = 20;

// A simple conversion factor to convert the size of one base-pair to one pixel. One for each dimension.
var scaleFactorQry = h / qrySeqs.reduce(function(p,c,i,a) {return p + c.length}, 0);
var scaleFactorRef = w / refSeqs.reduce(function(p,c,i,a) {return p + c.length}, 0);

var chartSpace = d3.selectAll("#chart")
.append("g")
.attr("id", "chartSpace")

var dotPlotSpace = d3.selectAll("#chart")
.attr("width", w + 2 * woff)
.attr("height", h + 2 * hoff + xLabOffset) //Adding space for the xLabs
.append("g")
.attr("transform", "translate(" + woff + "," + hoff + ")")
.attr("id", "dotPlotSpace");
    
// TODO: This is not ideomatic D3 - need to change to "g" and .call
var axisGroup = dotPlotSpace.selectAll("g.axis").data([0]).enter()
// Y Axis
axisGroup
.append("line")
.attr("x1", -1)
.attr("y1", h + 1)
.attr("x2", -1)
.attr("y2", 0)
.attr("stroke", "black")
.attr("stroke-width", 2);
// X Axis
axisGroup
.append("line")
.attr("x1", -1)
.attr("y1", h + 1)
.attr("x2", w)
.attr("y2", h + 1)
.attr("stroke", "black")
.attr("stroke-width", 2);

function SeqsSet() {
    var refLengths = {}
    var refCounts = {}
    
    function add(seqname, seqlength, hits) {
        if (counts[seqname]) {
            counts[seqname] += 1;
        } else {
            counts[seqname] = 0;
            lengths[seqname] = seqlength;
        }
    }
    
    function remove(seqname) {
        if (counts[seqname] > 1) {
            counts[seqname] -= 1;
        } else {
            counts[seqname] = 0;
            delete lengths[seqname];
        }
    }
    
    function getLengths() {return lengths;}
    function getLength(seqname) {return lengths[seqname];}
    
    return {add: add, remove: remove, lengths: getLengths, length: getLength};
}
    
var selected = new SeqsSet();

drawGroups();

drawGroups();

function drawGroups() {
    plotPositions = [];
    // The plotPositions array will contain objects that each describe one intersection of reference and query sequence:
    // Object
    //     boxHeight: 8.051897949176498
    //     boxWidth: 40.428410509069614
    //     hits: Array[2]
    //         0: Object
    //             boxHeight: 8.051897949176498
    //             qend: 383074
    //             qstart: 383351
    //             rend: 813032
    //             rstart: 812752
    //         1: Object
    //             boxHeight: 8.051897949176498
    //             qend: 382554
    //             qstart: 382898
    //             rend: 813519
    //             rstart: 813175
    //     offsetI: 0
    //     offsetJ: 82.54385984375311
    //     qryLength: 414739
    //     qryName: "SN15v2_scaffold_31"
    //     refLength: 1769547
    //     refName: "lm_SuperContig_7_v2"
    
    // This data structure is a little bit ugly, but it makes it very easy to work with d3. 
    //   The boxHeight data is copied three times so each hit know how far to come down from
    //   the top of the box.
    refSeqs.reduce(function(prevOffsetI,ref,i,refArray) {
        qrySeqs.reduce(function(prevOffsetJ,qry,j,qryArray) {
            var box = {}
            box.refLength = ref.length;
            box.qryLength = qry.length;
            box.offsetI = prevOffsetI * scaleFactorRef;
            box.offsetJ = prevOffsetJ * scaleFactorQry;
            box.refName = ref.name;
            box.qryName = qry.name;
            box.boxWidth = ref.length * scaleFactorRef;
            box.boxHeight = qry.length * scaleFactorQry;
            var hitsObject = byNamesGrp.all().filter(function(obj) {
                return obj.key[0] == ref.name && obj.key[1] == qry.name
            })[0];
            if (hitsObject) {
                box.hits = hitsObject.value.map(function(hit) {hit.boxHeight = box.boxHeight; return hit});
            } else {
                box.hits = [];
            }
            plotPositions.push(box);
            return prevOffsetJ + qry.length;
        }, 0)
        return prevOffsetI + ref.length;
    }, 0);
    
    var selectedRefNames = [];
    var selectedQryNames = [];
   
    var plots = dotPlotSpace.selectAll("g.boxPlotGroup")
    .data(plotPositions, function(d) {return d.refName + "-" + d.qryName;});
    
    var enterPlot = plots.enter()
    .append("g")
    .attr("class", function(d) {
        var s = d.refName.replace(/[\.\|]/g, "_") + " " + d.qryName.replace(/[\.\|]/g, "_") + " boxPlotGroup"
        return s;
    })
    .attr("id", function(d) {return d.testID;})
    .attr("transform", function(d) {return "translate(" + d.offsetI + "," + d.offsetJ + ")";});
    
    enterPlot
    .append("rect")
    .attr("width", function(d) {return d.boxWidth;})
    .attr("height", function(d) {return d.boxHeight;})
    .attr("x", 0)
    .attr("y", 0)
    .attr("refLength", function(d) {return d.refLength;})
    .attr("qryLength", function(d) {return d.qryLength;})
    .style("fill-opacity", 0)
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.05)
    .attr("fill", "steelblue")
    .on("mouseenter", function(d, i) {
        drawLabels(d);
        d3.select(this).style("fill-opacity", 0.1);
    })
    .on("mouseleave", function(d, i) {d3.select(this).style("fill-opacity", 0);})
    .on("click", function(d, i) {
        this.classList.toggle("selected");
        var opacity = this.classList.contains("selected") ? 0.2 : 0.05;
        this.setAttribute("stroke-opacity", opacity);
        drawSeqs();
    });
    
    // The hits data is nested inside the sequence intersection object.
    // Supplying a function to 'data' allows us to iterate through each of
    // these sub-objects.
    enterPlot.selectAll("line")
    .data(function(d) {return d.hits;})
    .enter()
    .append("line")
    .attr("x1", function(d) {return Math.round(d.rstart * scaleFactorRef);})
    .attr("y1", function(d) {return Math.round(d.boxHeight - d.qstart * scaleFactorQry)})
    .attr("x2", function(d) {return Math.ceil(d.rend * scaleFactorRef)})
    .attr("y2", function(d) {return Math.ceil(d.boxHeight - d.qend * scaleFactorQry)})
    .attr("rstart", function(d) {return d.rstart;})
    .attr("rend", function(d) {return d.rend;})
    .attr("stroke-width", 1)
    .attr("stroke", function(d) {
        if(d.qstart > d.qend) {
            // Make reverse matches red
            return "red";
        } else {
            // Make forward matches black
            return "black";
        }
    });
    
    function drawLabels(d) {
        var yLab = chartSpace.selectAll(".labelY")
        .data([d])
        
        yLab.enter()
        .append("text")
        .attr("class", "labelY")
        .attr("text-anchor", "end")
        .text(function(d) {return d.qryName;})
        .attr("x", woff - 10)
        .attr("y", function(d) {return d.offsetJ + hoff + d.boxHeight / 2;});
        
        yLab.transition()
        .text(function(d) {return d.qryName;})
        .duration(100)
        .attr("y", function(d) {return d.offsetJ + hoff + d.boxHeight / 2;})
        
        var xLab = chartSpace.selectAll(".labelX")
        .data([d])
        
        xLab.enter()
        .append("text")
        .attr("class", "labelX")
        .text(function(d) {return d.refName;})
        .attr("x", function(d) {return d.offsetJ + hoff + d.boxHeight / 2;})
        .attr("y", h + hoff + 20);
        
        xLab.transition()
        .text(function(d) {return d.refName;})
        .duration(200)
        .attr("x", function(d) {return d.offsetI + woff;})
    }
}

// Spacer width between seqs.
var spacing = 20;

// Width of the lower plot.
var w = 1000;

var compSpace = d3.selectAll("#comparison")
.attr("width", w + 2 * woff)
.attr("height", h + 2 * hoff)

var hitsFilter = crossfilter(delta.hits);
var byRefName = hitsFilter.dimension(function(d) {return d.rname;})
var byQryName = hitsFilter.dimension(function(d) {return d.qname;})
var byRefNameG = hitsFilter.dimension(function(d) {return d.rname;})
var byQryNameG = hitsFilter.dimension(function(d) {return d.qname;})
var byRefNameGrp = byRefNameG.group();
var byQryNameGrp = byQryNameG.group();


function drawSeqs() {
    var selectedSeqs = d3.selectAll(".selected")[0];
    
    function filterByHitRefName(d) {
        return selectedSeqs.some(function(seq) {
            return seq.__data__.refName == d;
        });
    }
    function filterByHitQryName(d) {
        return selectedSeqs.some(function(seq) {
            return seq.__data__.qryName == d;
        });
    }
    
    byRefName.filter(filterByHitRefName);
    byQryName.filter(filterByHitQryName);
    
    var selectedRefs = byRefNameGrp.all().filter(function(d) {return d.value > 0;}).map(function(d) {return {name: d.key, length: delta.refLengths[d.key]};});
    var selectedQrys = byQryNameGrp.all().filter(function(d) {return d.value > 0;}).map(function(d) {return {name: d.key, length: delta.qryLengths[d.key]};}).reverse();
    
    totalLengthRef = selectedRefs.reduce(function(p,c,i,a) {return p + c.length;},0) + spacing * selectedRefs.length;
    totalLengthQry = selectedQrys.reduce(function(p,c,i,a) {return p + c.length;},0) + spacing * selectedQrys.length;
    
    var scaleFactor = w / Math.max(totalLengthRef,totalLengthQry)
    counter = spacing;
    var startPositionRef = selectedRefs.map(function(seq) {var oldoffset = counter; counter += seq.length * scaleFactor + spacing; return oldoffset;});

    var scalesRef = {};
    var scalesQry = {};
    
    selectedRefs.forEach(function(seq, i) {
        var rangeStart = startPositionRef[i];
        var rangeStop = rangeStart + (scaleFactor * seq.length);
        scalesRef[seq.name] = d3.scale.linear()
        .domain([1,seq.length])
        .range([rangeStart,rangeStop])
    });
    
    // Calculate the average X position of the hits for each query so that I can 
    //   order the query sequences to minimise the number of matches that cross each other.
    var ordering = {}
    byQryName.top(Infinity).forEach(function(hit) {
        var averageXPosition = scalesRef[hit.rname]((hit.rend + hit.rstart) / 2);
        var hitLength = (hit.rend - hit.rstart) / 2;
        if(!ordering[hit.qname]) ordering[hit.qname] = {count: 0, total: 0};
        ordering[hit.qname].count += hitLength;
        ordering[hit.qname].total += scalesRef[hit.rname]((hit.rend + hit.rstart) / 2) * hitLength;
        ordering[hit.qname].average = ordering[hit.qname].total / ordering[hit.qname].count;
    })
    
    // A sorting function that takes two queries and compares their average X position as calculated above.
    function compareQrysByAverageHitXPos(qry1, qry2) {
        order1 = ordering[qry1.name].average;
        order2 = ordering[qry2.name].average;
        return order1 - order2;
    }
    
    counter = spacing;
    var startPositionQry = selectedQrys.sort(compareQrysByAverageHitXPos).map(function(seq) {var oldoffset = counter; counter += seq.length * scaleFactor + spacing; return oldoffset;});

    selectedQrys.forEach(function(seq, i) {
        var rangeStart = startPositionQry[i];
        var rangeStop = rangeStart + (scaleFactor * seq.length);
        scalesQry[seq.name] = d3.scale.linear()
        .domain([1,seq.length])
        .range([rangeStart,rangeStop])
    });
    
    function drawLabel(g) {
        if(this.classList.contains("refBlockGroup")) {
            var scales = scalesRef, y = 15;
        } else {
            var scales = scalesQry, y = 240;
        }
        
        var label = d3.select(this).selectAll("text.label").data([g], function(d) {return d.name;})
        label.enter()
        .append("text")
        .style("opacity", 0)
        .attr("class", "label")
        .attr("font-family", "sans-serif")
        .attr("x", function(d) {return scales[d.name](1);})
        .attr("y", y)
        .text(function(d) {return d.name;});
        label.transition()
        .duration(1000)
        .style("opacity", 1)
        .attr("x", function(d) {return scales[d.name](1);})
    }
    
    function drawBlock(g) {
        if(this.classList.contains("refBlockGroup")) {
            var scales = scalesRef, y = 20;
        } else {
            var scales = scalesQry, y = 200;
        }
        
        var rect = d3.select(this).selectAll("rect.seqBlock").data([g], function(d) {return d.name;})
        rect.enter()
        .append("rect")
        .attr("class", "seqBlock")
        .style("opacity", 0)
        .attr("x", function(d) {return scales[d.name](1);})
        .attr("y", y)
        .attr("width", function(d) {return d.length * scaleFactor;})
        .attr("height", 20)
        rect.transition()
        .duration(1000)
        .style("opacity", 0.7)
        .attr("x", function(d) {return scales[d.name](1);})
        .attr("width", function(d) {return d.length * scaleFactor;});
    }
    
    function drawBrush(g) {
        if(this.classList.contains("refBlockGroup")) {
            var scales = scalesRef, y = 20;
        } else {
            var scales = scalesQry, y = 200;
        }
        
        d3.select(this).selectAll("g.brush").data([g], function(g) {return g.name;})
        .enter()
        .append("g")
        .attr("class", "brush")
        .call(d3.svg.brush()
            .x(scales[g.name]))
        .selectAll("rect")
        .attr("y", y + 1)
        .attr("height", 18);
    }
    var refGroups = compSpace.selectAll("g.refBlockGroup").data(selectedRefs, function(d) {return d.name;})
    refGroups.enter()
    .append("g")
    .attr("class", "refBlockGroup")
    .each(drawBlock)
    .each(drawLabel)
    .each(drawBrush)
    refGroups
    .each(drawBlock)
    .each(drawLabel)
    .each(drawBrush)
    refGroups.exit().remove()
    
    var qryGroups = compSpace.selectAll("g.qryBlockGroup").data(selectedQrys, function(d) {return d.name;})
    qryGroups.enter()
    .append("g")
    .attr("class", "qryBlockGroup")
    .each(drawBlock)
    .each(drawLabel)
    .each(drawBrush)
    qryGroups
    .each(drawBlock)
    .each(drawLabel)
    .each(drawBrush)
    qryGroups.exit().remove()
    
    var matches = compSpace.selectAll("path.match").data(byRefName.top(Infinity), function(hit) {return [hit.rname, hit.rstart, hit.rend];})
    matches.enter()
    .append("path")
    .attr("class", "match")
    .attr("fill", function(d) {return (d.qstart < d.qend ? "steelblue" : "red");})
    .style("stroke", function(d) {return (d.qstart > d.qend ? "steelblue" : "red");})
    .style("stroke-opacity", 0.4)
    .attr("opacity", 0)
    .attr("d", function(d) {
        var refStart = scalesRef[d.rname](d.rstart);
        var refEnd = scalesRef[d.rname](d.rend);
        var qryStart = scalesQry[d.qname](d.qstart);
        var qryEnd = scalesQry[d.qname](d.qend);
        var path = "M " + refStart + " 50 L " + refEnd + " 50 L " + qryEnd + " 190 L " + qryStart + " 190 z";
        return path;
    })
    matches
    .transition()
    .duration(1000)
    .attr("fill", function(d) {return (d.qstart < d.qend ? "steelblue" : "red");})
    .attr("d", function(d) {
        var refStart = scalesRef[d.rname](d.rstart);
        var refEnd = scalesRef[d.rname](d.rend);
        var qryStart = scalesQry[d.qname](d.qstart);
        var qryEnd = scalesQry[d.qname](d.qend);
        var path = "M " + refStart + " 40 L " + refEnd + " 40 L " + qryEnd + " 200 L " + qryStart + " 200 z";
        return path;
    })
    .attr("opacity", 0.2)
    matches.exit().remove()
}
