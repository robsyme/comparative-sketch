// Spacer width between seqs.
var spacing = 20;

// Width of the lower plot.
var h = 400;

var linearPlotSpace = d3.selectAll("#linearPlot")
.attr("width", width + 2 * woff)
.attr("height", h + 2 * hoff)

var hitsFilter = crossfilter(delta.hits);
var byRefName = hitsFilter.dimension(function(d) {return d.rname;})
var byQryName = hitsFilter.dimension(function(d) {return d.qname;})
var byRefNameG = hitsFilter.dimension(function(d) {return d.rname;})
var byQryNameG = hitsFilter.dimension(function(d) {return d.qname;})
var byRefNameGrp = byRefNameG.group();
var byQryNameGrp = byQryNameG.group();

function drawLinearPlot() {
  var hitsFilter = crossfilter(delta.hits);
  
  function filterByHitRefName(d) {
      return selectedRegions.regions.some(function(region) {
          return region.refName == d;
      });
  }
  function filterByHitQryName(d) {
      return selectedRegions.regions.some(function(region) {
          return region.qryName == d;
      });
  }
  
  byRefName.filter(filterByHitRefName);
  byQryName.filter(filterByHitQryName);
  
  var selectedRefs = byRefNameGrp.all().filter(function(d) {return d.value > 0;}).map(function(d) {return {name: d.key, length: delta.refLengths[d.key]};});
  var selectedQrys = byQryNameGrp.all().filter(function(d) {return d.value > 0;}).map(function(d) {return {name: d.key, length: delta.qryLengths[d.key]};}).reverse();
  
  totalLengthRef = selectedRefs.reduce(function(p,c,i,a) {return p + c.length;},0);
  totalLengthQry = selectedQrys.reduce(function(p,c,i,a) {return p + c.length;},0);
  
  var refScaleFactor = (width - selectedRefs.length * spacing) / totalLengthRef;
  var qryScaleFactor = (width - selectedQrys.length * spacing) / totalLengthQry;
  var scaleFactor = Math.min(refScaleFactor,qryScaleFactor);
  
  counter = spacing;
  var startPositionRef = selectedRefs
  .map(function(seq) {
    var oldoffset = counter; counter += seq.length * scaleFactor + spacing;
    return oldoffset;
  });

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
  //  order the query sequences to minimise the number of matches that cross each other.
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
  var startPositionQry = selectedQrys
  .sort(compareQrysByAverageHitXPos)
  .map(function(seq) {
    var oldoffset = counter; counter += seq.length * scaleFactor + spacing;
    return oldoffset;
  });

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
      .on("mousemove", mouseoverBlock)
      rect.transition()
      .duration(1000)
      .style("opacity", 0.7)
      .attr("x", function(d) {return scales[d.name](1);})
      .attr("width", function(d) {return d.length * scaleFactor;});
  }
  
  var refGroups = linearPlotSpace.selectAll("g.refBlockGroup").data(selectedRefs, function(d) {return d.name;})
  refGroups.enter()
  .append("g")
  .attr("class", "refBlockGroup")
  .each(drawBlock)
  .each(drawLabel)
  refGroups
  .each(drawBlock)
  .each(drawLabel)
  refGroups.exit().remove()
  
  var qryGroups = linearPlotSpace.selectAll("g.qryBlockGroup").data(selectedQrys, function(d) {return d.name;})
  qryGroups.enter()
  .append("g")
  .attr("class", "qryBlockGroup")
  .each(drawBlock)
  .each(drawLabel)
  qryGroups
  .each(drawBlock)
  .each(drawLabel)
  qryGroups.exit().remove()
  
  function mouseoverBlock(d, i) {
    if(this.parentElement.classList.contains("refBlockGroup")) {
      var startPosition = startPositionRef;
      var startpos = scalesRef[d.name](0);
    } else {
      var startPosition = startPositionQry
      var startpos = scalesQry[d.name](0);
    }
    console.log((d3.mouse(this)[0] - startpos) / scaleFactor);
  }
  
  var matches = linearPlotSpace.selectAll("path.match").data(byRefName.top(Infinity), function(hit) {return [hit.rname, hit.rstart, hit.rend];})
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

