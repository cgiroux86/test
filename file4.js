console.log('Hello World, HELLOOO WORLDDDD!!!')
// 6 2 4


function normalizeFileInfoToBaseVersion(fileInfo) {
    const normalizedBaseFile: ShaDict = {};
    if (fileInfo.baseFileSha) {
      normalizedBaseFile.head = normalizedBaseFile.base = fileInfo.baseFileSha;
    }
    if (fileInfo.baseFileMode) {
      normalizedBaseFile.headMode = normalizedBaseFile.baseMode = fileInfo.baseFileMode;
    }
    if (fileInfo.type) normalizedBaseFile.type = fileInfo.type;
    return normalizedBaseFile;
  }
  
  function normalizeRevisionFiles(review) {
    const revKeys = _.sortBy(_.keys(review.revisions), key => +key.slice(1));
    // omit revision keys that are obsolete or precede an obsolete revision to
    // avoid folding onto an obsolete revision.
    const lastObsoleteRevisionIndex = _.findLastIndex(revKeys, key => review.revisions[key].obsolete);
    const lastInclusiveFilesKey =
      _.findLast(revKeys, key => _.every(review.files, file => file.revisions[key]));
    console.log('Last Key', lastInclusiveFilesKey);
    if (lastObsoleteRevisionIndex >= 0) revKeys.splice(0, lastObsoleteRevisionIndex + 1);
    return _.map(revKeys, key => {
      const fileInfo = _(review.files)
        // .reject(file => !file.revisions[key])
        .keyBy('path')
        .mapValues(file => file.revisions[key] ?
          normalizeFileInfo(file.revisions[key]) :
          normalizeFileInfoToBaseVersion(file.revisions[lastInclusiveFilesKey]))
        .value();
      console.log('Rev', fileInfo);
      return {hash: hashFileInfo(fileInfo), revision: review.revisions[key]};
    });
  }