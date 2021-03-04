import {readFileSync} from 'fs';
import path from 'path';
import _ from 'lodash';
import crypto from 'crypto';

// Mock revision and packet sequences

function hashFileInfo(fileInfo) {
  // convert paths + file info to string, sort, hash
  const sortedFilePaths = _(fileInfo).keys().sortBy().value();
  const revHash = crypto.createHash('sha256');
  _.forEach(sortedFilePaths, filePath => {
    // don't hash empty path if file info was deleted from revision
    if (_.isEmpty(fileInfo[filePath])) return;
    revHash.update(filePath);
    _(fileInfo[filePath]).keys().sortBy().forEach(key => {
      revHash.update(key);
      revHash.update(fileInfo[filePath][key]);
    });
  });
  return revHash.digest();
}

interface ShaDict {
  head? : string;
  headMode? : string;
  base? : string;
  baseMode? : string;
  type? : string;
}

function normalizeFileInfo(fileInfo) {
  const normalizedFileInfo : ShaDict = {};
  if (fileInfo.fileSha) normalizedFileInfo.head = fileInfo.fileSha;
  if (fileInfo.fileMode) normalizedFileInfo.headMode = fileInfo.fileMode;
  if (fileInfo.baseFileSha) normalizedFileInfo.base = fileInfo.baseFileSha;
  if (fileInfo.baseFileMode) normalizedFileInfo.baseMode = fileInfo.baseFileMode;
  if (fileInfo.type) normalizedFileInfo.type = fileInfo.type;
  return normalizedFileInfo;
}

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
  const firstInclusiveFilesKey =
    _.find(revKeys, key => _.every(review.files, file => file.revisions[key]));
  if (lastObsoleteRevisionIndex >= 0) revKeys.splice(0, lastObsoleteRevisionIndex + 1);
  return _.map(revKeys, key => {
    const fileInfo = _(review.files)
      .keyBy('path')
      .mapValues(file => file.revisions[key] ?
        normalizeFileInfo(file.revisions[key]) :
        normalizeFileInfoToBaseVersion(file.revisions[firstInclusiveFilesKey]))
      .value();
    return {hash: hashFileInfo(fileInfo), revision: review.revisions[key]};
  });
}

function normalizePacketFiles(packets) {
  return _.map(packets, packet => ({hash: packet.hash, packet: packet.revision}));
}

function areSubsequencesEqual(seq, leftStart, rightStart, windowLength) {
  while (windowLength-- > 0) {
    if (!seq[leftStart++].hash.equals(seq[rightStart++].hash)) return false;
  }
  return true;
}

function foldEquivalentPackets(revisions, packets) {
  if (packets.length < 2 && _.isEmpty(revisions)) return false;
  const joinedCandidates = [...revisions, ...packets];
  let windowLength = Infinity, candidatesModified = false;

  while (windowLength > 0) {
    if (windowLength === Infinity) {
      windowLength = Math.min(packets.length, Math.floor(joinedCandidates.length / 2));
      if (windowLength === 0) break;
    }
    const start = Math.max(revisions.length, windowLength);
    for (let i = start; i + windowLength <= joinedCandidates.length; i++) {
      if (areSubsequencesEqual(joinedCandidates, i - windowLength, i, windowLength)) {
        candidatesModified = true;
        for (let j = i; j < i + windowLength; j++) {
          mergeEquivalentCandidateShas(joinedCandidates[j - windowLength], joinedCandidates[j]);
        }
        joinedCandidates.splice(i, windowLength);
        packets.splice(i - revisions.length, windowLength);
        windowLength = Infinity;
        break;
      }
    }
    windowLength--;
  }
  return candidatesModified && mergeCandidateEquivalents(joinedCandidates);
}

function mergeCandidateEquivalents(candidates) {
  _.forEach(candidates, candidate => {
    if (!candidate.equivalentBaseCommitShas && !candidate.equivalentCommitShas) return;
    if (candidate.revision) {
      mergeEquivalentPacketShasWithRevision(candidate);
    } else {
      mergeEquivalentPacketShas(candidate);
    }
  });
  return true;
}

function mergeEquivalentPacketShasWithRevision(candidate) {
  // keep old timestamp & add current SHAs to appropriate equivalents
  candidate.revision.equivalentBaseCommitShas = _(candidate.revision.equivalentBaseCommitShas || '')
      .split(',')
      .compact()
      .concat(candidate.equivalentBaseCommitShas)
      .push(candidate.revision.baseCommitSha)
      .uniq()
      .join(',');
  candidate.revision.equivalentCommitShas = _(candidate.revision.equivalentCommitShas || '')
      .split(',')
      .compact()
      .concat(candidate.equivalentCommitShas)
      .push(candidate.revision.commitSha)
      .uniq()
      .join(',');
  candidate.revision.commits = candidate.commits;
  candidate.revision.commitSha = _.last(candidate.equivalentCommitShas);
  candidate.revision.baseCommitSha = _.last(candidate.equivalentBaseCommitShas);
}

function mergeEquivalentPacketShas(candidate) {
  const packet = candidate.packet;
  packet.lastMeaningfulCommit = _.last(candidate.equivalentCommitShas);
  packet.equivalentCommitShas = candidate.equivalentCommitShas;
  packet.equivalentBaseCommitShas = candidate.equivalentBaseCommitShas;
  packet.commits = candidate.commits;
}

function mergeEquivalentCandidateShas(candidate, equivalent) {
  candidate.equivalentBaseCommitShas = (candidate.equivalentBaseCommitShas || [])
    .concat(equivalent.equivalentBaseCommitShas || []);
  candidate.equivalentCommitShas = (candidate.equivalentCommitShas || [])
    .concat(equivalent.equivalentCommitShas || []);
  candidate.equivalentBaseCommitShas.push(equivalent.packet.baseCommitSha);
  candidate.equivalentCommitShas.push(equivalent.packet.headCommitSha);
  candidate.commits = equivalent.packet.commits;
}

function prepareReview() {
  // possible this may need to be normalized for windows
  const file = path.join(__dirname, '../demo_review.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('test review folding algorithm', () => {
  const review = prepareReview();
  let packets, revisions;
  beforeEach(() => {
    packets = normalizeRevisionFiles(review);
    revisions = normalizeRevisionFiles(review);
  });

  test('review working', () => {
    expect(review).toHaveProperty('files');
  });

  test('matching sequences', () => {
    expect(revisions).toEqual(packets);
  });

  test('folding properly', () => {
    packets = normalizePacketFiles(packets);
    foldEquivalentPackets(revisions, packets);
    expect(packets).toHaveLength(0);
  });

  describe('folds single end packet correctly', () => {
    it('should match the last revision if packet is the same', () => {
      packets = normalizePacketFiles(packets);
      const firstPacket = [_.last(packets)];
      foldEquivalentPackets(revisions, firstPacket);
      expect(firstPacket.length).toBe(0);
    });
    it('should not match the last revision if packet is different', () => {
      packets = normalizePacketFiles(packets);
      const lastPacket = [_.head(packets)];
      foldEquivalentPackets(revisions, lastPacket);
      expect(lastPacket.length).toBe(1);
    });
  });

  test('folding ends correctly', () => {
    const revLength = revisions.length;
    packets = normalizePacketFiles(
      _.fill(new Array(3).concat(packets), _.last(revisions), 0, 3)
    );
    foldEquivalentPackets(revisions, packets);
    expect(packets).toHaveLength(0);
    expect(revisions.length).toEqual(revLength);
  });

  describe('folds various sequences correctly', () => {
    /* eslint-disable max-len*/
    it('should fold down to 2 packets if first packet differs from last rev and remaining packets are equivalent', () => {
      packets = normalizePacketFiles(
        revisions.slice(0, 1).concat(_.fill(new Array(5), _.last(revisions), 0, 5))
      );
      foldEquivalentPackets(revisions, packets);

      expect(packets).toHaveLength(2);
    });
    it('should fold long sequences correctly', () => {
      const frontPackets = revisions.slice(0, 2), endPackets = revisions.slice(2);
      packets = normalizePacketFiles(
        packets.concat(frontPackets).concat(endPackets)
      );
      foldEquivalentPackets(revisions, packets);
      expect(packets).toHaveLength(0);
    });
  });

  it('should partially fold long sequences correctly', () => {
    const frontPackets = revisions.slice(0, 2);
    const midPackets = revisions.slice(2, 4);
    const endPackets = revisions.slice(4);
    const endsAreSame = normalizePacketFiles(
      endPackets.concat(endPackets).concat(midPackets)
    );
    const endsAreDifferent = normalizePacketFiles(
      midPackets.concat(frontPackets).concat(endPackets)
    );
    foldEquivalentPackets(revisions, endsAreSame);
    foldEquivalentPackets(revisions, endsAreDifferent);
    expect(endsAreSame).toHaveLength(2);
    expect(endsAreDifferent).toHaveLength(5);
  });
});

