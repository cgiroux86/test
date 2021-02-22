function foldEquivalentPackets(review, packets) {
  const joinedSequence = [...review, ...packets];
  const equivalentsToProcess = [];
  let windowSize = Math.min(packets.length, Math.floor(joinedSequence.length / 2));
  // start with largest possible window and collapse.
  while (windowSize > 0) {
    let rightWindowStart = joinedSequence.length - windowSize, rightWindowEnd = joinedSequence.length-1
    let leftWindowStart = rightWindowStart - windowSize, leftWindowEnd = leftWindowStart + windowSize - 1;
    while (leftWindowStart < rightWindowStart) {
      const areEqual = areSubsequencesEqual(
        leftWindowStart, leftWindowEnd, rightWindowStart, rightWindowEnd, joinedSequence
      );
      if (areEqual) {
        joinedSequence.splice(rightWindowStart, rightWindowEnd - rightWindowStart + 1);
        packets.splice(0, rightWindowEnd - rightWindowStart+1);
        windowSize = Math.min(
          packets.length, Math.floor(joinedSequence.length / 2)
        );
        break;
      }
      leftWindowStart++, rightWindowEnd--;
    }
    windowSize--;
  }
}


function equivalents(review, packets) {
  let joinedSequence = [...review, ...packets];
  let windowSize = Infinity;
  while (windowSize > 0) {
    if (windowSize === Infinity) {
      windowSize = Math.min(packets.length, Math.floor(joinedSequence.length / 2));
    }
    for (let start = Math.max(review.length, windowSize); start < (joinedSequence.length - windowSize); start++) {
      if (areEqual(joinedSequence, start-windowSize, start, windowSize)) {
        joinedSequence.splice(start, windowSize)
        packets.slice(start-review.length, windowSize);
        windowSize = Math.min(packets.length, Math.floor(joinedSequence.length / 2)) + 1
        break;
      }
    }
    windowSize--
  }
  console.log(joinedSequence);
}

// ABABaba A(BAB)[aba] -> ABAB
    // while (windowSize <= N) {
    //    for (let start = 1; start < packets.length; start++) {
    //        const offset = start - windowSize;
    //        if (offset >= 0) {
    //            const L = packets.slice(offset, offset+windowSize), R = packets.slice(start, start+windowSize)
    //            if (L.match(/[A-Z]/g) && R.match(/[A-Z]/g)) continue;
    //            if (L.toLowerCase() === R.toLowerCase()) { 
    //                 packets = packets.slice(0, offset+windowSize) + packets.slice(start+windowSize), windowSize = 1
    //             }
    //        }
    //    }
    //    windowSize++;
    // }

    function areEqual(seq, leftStart, rightStart, windowSize) {
      while (windowSize > 0) {
        if (seq[leftStart++] !== seq[rightStart++]) return false;
        windowSize--
      }
      return true;
    }

    function areSubsequencesEqual(leftStart, leftEnd, rightStart, rightEnd, sequence) {
      while (leftStart <= leftEnd && rightStart <= rightEnd) {
        const leftItem = sequence[leftStart++]
        const rightItem = sequence[rightStart++]
        console.log(leftItem, rightItem);
        if (leftItem !== rightItem) return false;
      }
      return true;
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
  


//(ABABa)[babab] => A(BABa)[baba]b => ABABb => ABAB
equivalents(['a', 'b', 'b', 'c'],  ['b', 'c', 'b', 'a']);
equivalents(['a', 'b', 'b', 'a'], ['a', 'b', 'b', 'a', 'a', 'b', 'b', 'a']);
equivalents(['a', 'b','c'], ['a', 'b', 'c'])
// (AB)[BA] => A(B)[B] A
