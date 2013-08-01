function DeltaParser(path) {
    
    var hits;
    var refLengths = {};
    var qryLengths = {};
    
    var xhReq = new XMLHttpRequest();
    
    function Hit(rname, qname, rstart, rend, qstart, qend, similarity) {
        this.rname = rname;
        this.qname = qname;
        this.rstart = rstart;
        this.rend = rend;
        this.qstart = qstart;
        this.qend = qend;
        this.orientation = qend > qstart;
        this.similarity = similarity;
    }
    
    function extractMatches(record) {
        var lines = record.split("\n");
        var h = lines.shift().split(' ');
        
        var refName = h[0];
        var qryName = h[1];
        
        refLengths[refName] = Number(h[2]);
        qryLengths[qryName] = Number(h[3]);
        
        return lines
        .filter(function(line) {
            return /\d+ \d+ \d+ \d+ \d+ \d+ \d+/.test(line)
        })
        .map(function(line) {
            var coords = line.split(' ').map(function(n) {return Number(n)});
            var percentSimilar = (coords[3] + coords[4]) / Math.max(coords[0]+coords[1], coords[2]+coords[3])
            var hit = new Hit(refName, qryName, coords[0], coords[1], coords[2], coords[3], percentSimilar);
            return hit;
        });
    }
    
    function parseText(rawText) {
        var records = rawText.split(/\n>/);
        records.shift();
        return [].concat.apply([],records.map(extractMatches));
    }
    
    function handleRequest(evt) {
        hits = parseText(evt.currentTarget.responseText)
        return hits;
    }
    
    function refs() {
        var refs = []
        for(var propt in refLengths){
            refs.push({name: propt, length: refLengths[propt]})
        }
        return refs;
    }
    
    function qrys() {
        var qrys = []
        for(var propt in qryLengths){
            qrys.push({name: propt, length: qryLengths[propt]})
        }
        return qrys;
    }
    
    function refLengths() {return refLengths;}
    function qryLengths() {return qryLengths;}
    
    xhReq.open("GET", path, false)
    xhReq.onload = handleRequest;
    xhReq.send();
    
    return {hits: hits, parse: parseText, handleRequest: handleRequest, refLengths: refLengths, qryLengths: qryLengths, refs: refs, qrys: qrys}
}