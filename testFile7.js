
function foldEquivalentPackets (revisions, packets) {
    const string = revisions.concat(packets).join('')
    let N = Math.min(packets.length, Math.floor(string.length / 2)), windowSize = 1;
    packets = revisions.concat(packets).join('');

    while (windowSize <= N) {
       for (let start = 1; start < packets.length; start++) {
           const offset = start - windowSize;
           if (offset >= 0) {
               const L = packets.slice(offset, offset+windowSize), R = packets.slice(start, start+windowSize)
               if (L.match(/[A-Z]/g) && R.match(/[A-Z]/g)) continue;
               if (L.toLowerCase() === R.toLowerCase()) { 
                    packets = packets.slice(0, offset+windowSize) + packets.slice(start+windowSize), windowSize = 1
                }
           }
       }
       windowSize++;
    }
    console.log(packets);


  
}

function foldEquivalentRevisions (revisions, packets) {
    
}

function normalizeRevisionsToPacketFiles(review, packets) {
    // we can hash the file path and shas, but I'm affraid order will matter here?
    // Perhaps we sort by file name before hashing? This would allow us to compare objects,
    // but make it more difficult to distinguish what's a revision and what's a packet.
    const revisionFiles = {};
    const packetFiles = [];
    const revKeys = _.sortBy(_.keys(review.revisions), rev => +rev.slice(1));
    const files = _.values(review.files);
    for (const file of files) {
      for (const key of revKeys) {
        if (file.revisions?.[key]?.fileSha) {
          if (key in revisionFiles) revisionFiles[key][file.path] = file.revisions[key].fileSha;
          else revisionFiles[key] = {[file.path]: file.revisions[key].fileSha};
        }
      }
    }
    for (const packet of packets) {
      const item = {};
      _.forEach(packet.fileShas, (fileSha, fileName) => item[fileName] = fileSha.head);
      packetFiles.push(_.omitBy(item, _.isUndefined));
    }
    return [_.values(revisionFiles), packetFiles];
  }
  
  function foldEquivalentPackets(review, packets) {
    // (TODO): Figure out how to flag a revision so we can distinguish what should be folded and
    // what shoudln't. Refine and improve logic to make more efficient if possible.
    const [revisionFiles, packetFiles] = normalizeRevisionsToPacketFiles(review, packets);
    let joinedSequence = revisionFiles.concat(packetFiles), windowSize = 1;
    const N = Math.min(packets.length, Math.floor(joinedSequence.length / 2));
    while (windowSize <= N) {
      for (let start = 1; start < packets.length; start++) {
        const offset = start - windowSize;
        if (offset >= 0) {
          const left = packets.slice(offset, offset + windowSize);
          const right = packets.slice(start, start + windowSize);
          // this was a proof of concept for comparing sequences like ABABababc or ABABc
          if (left.match(/[A-Z]/g) && right.match(/[A-Z]/g)) continue;
          if (_.isEqual(left, right)) {
            // (Todo): implement folding logic.
            joinedSequence = joinedSequence.slice(0, offset + windowSize).concat(
              joinedSequence.slice(start + windowSize)
            );
            windowSize = 1;
          }
        }
      }
      windowSize++;
    }
  }


foldEquivalentPackets(["A", "B", "A", "B", "C"],  ['a', 'b','a', 'b','a', 'b']);