import {readFileSync} from 'fs';
import path from 'path';
import _ from 'lodash';
import crypto from 'crypto';
import {TESTABLES} from '../github/pull_requests';
import demoPackets from './mock_packets.json';
import largeMockPackets from './large_mock_packets.json';
import largeMockRevisions from './large_mock_revisions.json';
const {
  foldEquivalentPackets,
  hashFileInfo,
  isRebasedFileRevModified,
  makeAuthorLink,
  makeCommitLink,
  mergeEquivalentCandidateInfo,
  normalizeFileInfo,
  normalizeRevisionInfo,
  selectRevisionCommitIndexes,
  snapshotRevision,
  inferPriorRevisionKeys,
  setRevisionCommits,
} = TESTABLES;

interface MockPacket {
    headCommit: any;
    baseCommit: {sha: string};
    fileShas: any;
    commits: any[];
    lastMeaningfulCommit: any;
    index: number;
    commit: any;
    author: {id: number, name: string};
}

interface MockRevision {
    commitSha: string;
    revision: any;
    index: number;
}

let review = prepareReview();
const revKeys = _.sortBy(_.keys(review.revisions), key => _.parseInt(key.slice(1)));
const lastKey = _.last(revKeys);
const prTimestamp = Date.now();
const baselineFileSha = 'abc123';

const sampleCommits = [
  {
    sha: '12345',
    author: {id: 12345, date: Date.now()},
    commit: {
      sha: 'testing1',
      author: {id: 34567, name: 'test', date: Date.now()},
      committer: {date: Date.now()},
      message: 'This is test message 1'
    }
  },
  {
    sha: '67890',
    author: {id: 12345, date: Date.now()},
    commit: {
      sha: 'testing3',
      author: {id: 34567, name: 'test1', date: Date.now()},
      committer: {date: Date.now()},
      message: 'This is test message 1'
    }
  }
];

const secondaryCommits = [
  {
    sha: 'abcde',
    author: {id: 12345, date: Date.now()},
    commit:  {
      sha: 'abcde',
      author: {id: 34567, name: 'cgiroux', date: Date.now()},
      committer: {date: Date.now()},
      message: 'This is test message 1'
    }
  },
  {
    sha: 'fghij',
    author: {id: 12345, date: Date.now()},
    commit:  {
      sha: 'fghij',
      author: {id: 34567, name: 'cgiroux', date: Date.now()},
      committer: {date: Date.now()},
      message: 'This is test message 1'
    }
  },
];

function mockPacketFiles() {
  const lastObsoleteRevisionIndex = _.findLastIndex(revKeys, key => review.revisions[key].obsolete);
  if (lastObsoleteRevisionIndex >= 0) revKeys.splice(0, lastObsoleteRevisionIndex + 1);
  return _.map(revKeys, (key, index) => {
    const fileInfo = _(review.files)
      .reject(file => !file.revisions[key])
      .keyBy('path')
      .mapValues(file => normalizeFileInfo(file.revisions[key]))
      .value();
    const newPacket: Partial<MockPacket> = {
      headCommit: sampleCommits[0],
      baseCommit: {sha: review.revisions[key].baseCommitSha},
      fileShas: fileInfo,
      author: {id: 12345, name: 'cgiroux'},
      commits: sampleCommits,
      lastMeaningfulCommit: sampleCommits[1],
      index
    };
    return newPacket;
  });
}

function serializeCommitShas(commits) {
  // adjust logic based on whether we are serializing a packet or revision.
  return _.isArray(commits) ?
    _.map(commits, commit => commit.commit.sha).join('') :
    _.map(_.values(commits), 'sha').join('');
}

function prepareReview() {
  // possible this may need to be normalized for windows
  const file = path.join(__dirname, '../demo_review.json');
  const mockedReview = JSON.parse(readFileSync(file, 'utf8'));
  _.forEach(mockedReview.revisions, revision => {
    // One revision only has 1 commit and it messes up our message hashing,
    // so add one on for uniformity
    if (_.size(revision.commits) === 1) revision.commits.c1 = _.cloneDeep(revision.commits.c0);
    _.forEach(revision.commits, commit => {commit.title = 'This is test message 1';});
  });
  return mockedReview;
}

function preparePackets() {
  return _.cloneDeep(demoPackets);
}

function doShasOverlap(equivs, commitSha) {
  return _.includes(equivs, commitSha);
}

function mergeDoesNotDuplicateEquivalents() {
  return _.every(_.values(review.revisions).slice(5), (rev, index) => {
    switch (index) {
      case 0: return rev.equivalentCommitShas.split(',').length === 99 &&
        !doShasOverlap(rev.equivalentCommitShas, rev.commitSha);
      case 1: return rev.equivalentCommitShas.split(',').length === 199 &&
        !doShasOverlap(rev.equivalentCommitShas, rev.commitSha);
      case 2: return rev.equivalentCommitShas.split(',').length === 299 &&
        !doShasOverlap(rev.equivalentCommitShas, rev.commitSha);
      case 3: return rev.equivalentCommitShas.split(',').length === 399 &&
        !doShasOverlap(rev.equivalentCommitShas, rev.commitSha);
      case 4: return rev.equivalentCommitShas.split(',').length === 499 &&
        !doShasOverlap(rev.equivalentCommitShas, rev.commitSha);
      default: return false;
    }
  });
}


function generateLargePacketSequence(start, stop, packets, baselineCommitSha) {
  const packetSequence = [];
  while (start <= stop) {
    const packetToCopy = packets[start / 100 - 1];
    packetSequence.push(
      ..._.map(_.times(start, () => _.cloneDeep(packetToCopy)), (packet, index) =>
        _.assign(packet, packet.headCommit.sha = baselineCommitSha + String(index)))
    );
    start += 100;
  }
  return packetSequence;
}

function mockRebasedPackets(packets) {
  packets = _.map(packets, (packet, index) => {
    const revisionCommits = review.revisions[`r${index + 1}`].commits;
    packet = _.cloneDeep(packet);
    packet.commits[0].commit.message = revisionCommits.c0.title;
    packet.commits[1].commit.message = revisionCommits.c0.title;
    _.forEach(packet.fileShas, file => {file.head = file.base = baselineFileSha;});
    packet.headCommit.sha = '000' + String(index);
    return packet;
  });
  packets[2].commits.pop();
  return packets;
}

function setObsoleteFlag(revisions, revisionKeys) {
  _.forEach(revisions, (revision, revKey) => {
    if (_.includes(revisionKeys, revKey)) revision.obsolete = false;
    else revision.obsolete = true;
  });
}

function doesRebaseShowCriticalDiff(fileRevs, adjustedIndex, revision) {
  const revKey = `r${adjustedIndex + 1}`;
  return isRebasedFileRevModified(fileRevs, revision.priorRevisionKey, revKey) &&
      (fileRevs[revKey]?.fileSha === fileRevs[revKey]?.baseFileSha &&
         fileRevs[revKey]?.action === 'modified');
}

function generateMockedPacketCommit(message, authorDate, authorId) {
  const commit = _.cloneDeep(demoPackets[0].commits[0]);
  commit.commit.message = message;
  commit.commit.author.date = authorDate;
  commit.author.id = authorId;
  return commit;
}

function generateMockedRevision(numberOfCommits) {
  const revision = _.cloneDeep(review.revisions.r1);
  _.forEach(_.fill(new Array(numberOfCommits), null), (ele, i) => {
    revision.commits[`c${i}`] = {
      title: `This is title ${i + 1}`,
      authorTimestamp: Date.now() + (i * 1000),
      authorKey: 'github:12321',
    };
  });
  return revision;
}

function mainTest(coreAuthor) {
  let packets, commits;
  beforeEach(() => {
    packets = mockPacketFiles();
    review = prepareReview();
    commits = _.keyBy(sampleCommits.concat(secondaryCommits), 'sha');
    review.core.authorKey = coreAuthor ?
      (coreAuthor === 'no author' ? null : 'github:12345') :
      review.core.authorKey;
  });

  describe('should generate packets correctly', () => {
    it('should not include files where SHAs have been deleted', () => {
      const mockFiles = {path: {}, path1: {}};
      const emptyHash = crypto.createHash('sha256').update('').digest();
      expect(hashFileInfo(mockFiles).equals(emptyHash)).toBeTruthy();
    });
  });

  describe('does not fold onto revisions', () => {
    it('should not fold revisions onto eachother', () => {
      const revs = normalizeRevisionInfo(review), length = revs.length;
      foldEquivalentPackets(revs, [], prTimestamp);
      expect(revs).toHaveLength(length);
    });
  });

  describe('folds respect latest commit shas', () => {
    const baselineCommitSha = '0000';
    it('should not return an older commit sha as headCommit on packet fold', () => {
      const firstPacket: MockPacket = _.cloneDeep(_.head(packets));
      const lastPacket: MockPacket = _.cloneDeep(_.head(packets));
      let newPackets: MockPacket[] = _.map([firstPacket, lastPacket], (packet, index) =>
        _.assign(packet, packet.headCommit.sha = baselineCommitSha + String(index)));

      foldEquivalentPackets({}, newPackets, prTimestamp);
      expect(newPackets).toHaveLength(1);
      expect(newPackets[0].headCommit.sha).toEqual(lastPacket.headCommit.sha);

      newPackets = [firstPacket, lastPacket];
      lastPacket.headCommit = sampleCommits[1];
      foldEquivalentPackets({}, newPackets, prTimestamp);
      expect(newPackets).toHaveLength(1);
      expect(firstPacket.headCommit).toEqual(sampleCommits[1]);
    });
    it('should snapshot a revision with the topologically newest commit', () => {
      const firstPackets = _.map(_.times(10, () => _.cloneDeep(packets[0])), (packet, index) =>
        _.assign(packet, packet.headCommit.sha = baselineCommitSha + String(index)));
      foldEquivalentPackets({}, firstPackets, prTimestamp);

      expect(firstPackets).toHaveLength(1);
      expect(firstPackets[0].headCommit.sha).toEqual(baselineCommitSha + String(9));

      snapshotRevision(review, firstPackets[0], commits, prTimestamp);
      expect(review.revisions.r6.commitSha).toEqual(baselineCommitSha + String(9));
    });
  });

  describe('folds single end packet correctly', () => {
    it('should match the last revision if packet is the same', () => {
      const firstPacket = [_.last(packets)] as MockPacket[];
      foldEquivalentPackets(review, firstPacket, prTimestamp);
      expect(firstPacket).toHaveLength(0);
    });
    it('should not match the last revision if packet is different', () => {
      const lastPacket = [_.head(packets)];
      foldEquivalentPackets(review, lastPacket, prTimestamp);
      expect(lastPacket).toHaveLength(1);
    });
  });

  describe('folds sequences of different packets correctly', () => {
    it('should fold 6 packets to 3 if they are sequential matches', () => {
      const firstPackets: MockPacket[] = packets.slice(0, 3);
      const secondPackets: MockPacket[] = packets.slice(0, 3);
      const joinedCandidates = firstPackets.concat(secondPackets);
      foldEquivalentPackets({}, joinedCandidates, prTimestamp);
      expect(joinedCandidates).toHaveLength(3);
    });
  });

  describe('folds various sequences correctly', () => {
    it('should not fold past packet that does not match a revision', () => {
      const front = packets.slice(0, 2), end = packets.slice(4);
      const newPackets = end.concat(front).concat(front);
      foldEquivalentPackets(review, newPackets, prTimestamp);
      expect(newPackets).toHaveLength(2);
    });
    it('should fold long sequences correctly', () => {
      foldEquivalentPackets(review, packets, prTimestamp);
      expect(packets).toHaveLength(0);
    });
    it('should partially fold long sequences correctly', () => {
      const frontPackets = packets.slice(0, 2);
      const midPackets = packets.slice(2, 4);
      const endPackets = packets.slice(4);
      const endsAreSame = endPackets.concat(endPackets).concat(midPackets);
      const endsAreDifferent = midPackets.concat(frontPackets).concat(endPackets);
      foldEquivalentPackets(review, endsAreSame, prTimestamp);
      foldEquivalentPackets(review, endsAreDifferent, prTimestamp);
      expect(endsAreSame).toHaveLength(2);
      expect(endsAreDifferent).toHaveLength(5);
    });
  });

  describe('merge commits correctly', () => {
    it('should fold first packets commits onto last revision', () => {
      foldEquivalentPackets(review, packets, prTimestamp);
      expect(serializeCommitShas(review.revisions[lastKey].commits)).toEqual('1234567890');
    });
    it('should fold a full sequential match commits correctly', () => {
      foldEquivalentPackets(review, packets, prTimestamp);
      let serializedCommits = '';
      _.forEach(review.revisions, rev => {
        serializedCommits += serializeCommitShas(rev.commits);
      });
      expect(serializedCommits).toEqual(_.repeat('1234567890', _.size(review.revisions)));
    });
    it('should not fold first packet commits if index is smaller (earlier in sequence)', () => {
      const firstPacket: MockPacket = _.head(packets);
      firstPacket.index = 1;
      const lastRevision: any = _.last(normalizeRevisionInfo(review));
      lastRevision.index = Infinity;
      mergeEquivalentCandidateInfo(lastRevision, {packet: firstPacket});
      expect(serializeCommitShas(lastRevision.commits)).not.toEqual('123456789');
      const secondPacket: MockPacket = _.last(packets);
      secondPacket.index = 0;
      secondPacket.commits = secondaryCommits;
      mergeEquivalentCandidateInfo(firstPacket, {packet: secondPacket});
      expect(serializeCommitShas(firstPacket.commits)
        .match(serializeCommitShas(secondPacket.commits))).toBeFalsy();
    });
  });

  describe('populate new commit links correctly', () => {
    const lastRevision: Partial<MockRevision> = _.last(normalizeRevisionInfo(review)).revision;
    it('should create a new link when commits are merged', () => {
      const firstCommitURL = makeCommitLink(review, lastRevision.commitSha);
      foldEquivalentPackets(review, [_.last(packets)], prTimestamp);
      const foldedRevision = _.last(_.values(review.revisions));
      const newCommitURL = makeCommitLink(review, foldedRevision.commitSha);
      expect(firstCommitURL).not.toEqual(newCommitURL);
    });
    it('should not create a new link if commits are not merged', () => {
      lastRevision.index = Infinity;
      const firstCommitURL = makeCommitLink(review, lastRevision.commitSha);
      mergeEquivalentCandidateInfo(lastRevision, {packet: _.head(packets)});
      const newCommitURL = makeCommitLink(review, lastRevision.commitSha);
      expect(firstCommitURL).toEqual(newCommitURL);
    });
  });

  describe('generates correct commit indexes', () => {
    const combinedCommits = sampleCommits.concat(secondaryCommits); // length is 4
    let indexes;
    it('should return all the commits if strategy is 1 per commit and new index is 0', async () => {
      indexes = await selectRevisionCommitIndexes(combinedCommits, [], 0, 'onePerCommit', null);
      expect(indexes).toHaveLength(4);
      expect(indexes).toEqual([0, 1, 2, 3]);
    });
    it('should return an empty list if no new commits', async () => {
      indexes = await selectRevisionCommitIndexes(combinedCommits, [], 5, 'onePerCommit', null);
      expect(indexes).toHaveLength(0);
    });
    it('should return [3] if first new commit index equals length of commits - 1', async () => {
      indexes = await selectRevisionCommitIndexes(combinedCommits, [], 3, '', null);
      expect(indexes).toEqual([3]);
    });
  });

  describe('snapshots a packet into a revision correctly', () => {
    const lengthPriorToFolding = _.size(review.revisions);
    const combinedCommits = sampleCommits.concat(secondaryCommits);
    it('should snapshot all packets into revisions if no folds', () => {
      // packets has length of 5, so trim it down to make this easier
      packets = packets.slice(1);
      // switch up commits so we actually snapshot a revision
      _.forEach(packets, (packet, index: number) => {
        packet.headCommit = combinedCommits[index];
        snapshotRevision(review, packet, commits, prTimestamp);
      });
      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + combinedCommits.length);
    });
    it('should not error on packets that have been folded onto, but still need snapshotted', () => {
      const frontPackets = packets.slice(0, 2);
      const joinedCandidates = frontPackets.concat(frontPackets);
      _.forEach(joinedCandidates, (packet, index: number) => {
        packet.headCommit = combinedCommits[index];
      });
      foldEquivalentPackets(review, joinedCandidates, prTimestamp);
      _.forEach(joinedCandidates, packet => {
        snapshotRevision(review, packet, commits, prTimestamp);
      });
      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + joinedCandidates.length);
    });
    it('should not snapshot new revisions if all packets have been folded', () => {
      foldEquivalentPackets(review, packets, prTimestamp);
      expect(lengthPriorToFolding).toEqual(_.size(review.revisions));
    });
  });

  describe('impervious to size', () => {
    const lengthPriorToFolding = _.size(review.revisions), baselineCommitSha = '0000';
    it('should fold a long sequence of only packets correctly', () => {
      packets = generateLargePacketSequence(100, 200, packets, baselineCommitSha);

      foldEquivalentPackets({}, packets, prTimestamp);
      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});

      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + 2);
    });
    it('should fold a long sequence of revisions and packets correctly', () => {
      packets = generateLargePacketSequence(100, 200, packets, baselineCommitSha);
      foldEquivalentPackets(review, packets, prTimestamp);

      expect(packets).toHaveLength(2);
      expect(packets[0].headCommit.sha).toEqual(baselineCommitSha + '99');
      expect(packets[1].headCommit.sha).toEqual(baselineCommitSha + '199');

      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});
      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + 2);
      const newRevisionsLength = _.size(review.revisions);
      foldEquivalentPackets(review, packets, prTimestamp);
      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});
      expect(newRevisionsLength).toEqual(_.size(review.revisions));
    });
    it('should fold multiple long sequences of packets equivalents correctly', () => {
      packets = generateLargePacketSequence(100, 500, packets, baselineCommitSha);

      foldEquivalentPackets({}, packets, prTimestamp);
      expect(packets).toHaveLength(5);
      expect(packets[0].headCommit.sha).toEqual(baselineCommitSha + '99');
      expect(packets[1].headCommit.sha).toEqual(baselineCommitSha + '199');
      expect(packets[2].headCommit.sha).toEqual(baselineCommitSha + '299');
      expect(packets[3].headCommit.sha).toEqual(baselineCommitSha + '399');
      expect(packets[4].headCommit.sha).toEqual(baselineCommitSha + '499');
      const revisionsLength = _.size(review.revisions);
      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});
      expect(_.size(review.revisions)).toEqual(revisionsLength + 5);
      expect(_.every(_.values(review.revisions).slice(5), (rev, index) =>
        rev.commitSha === packets[index].headCommit.sha)).toBeTruthy();
      expect(mergeDoesNotDuplicateEquivalents()).toBeTruthy();
    });
    it('should not duplicate equivalent commits for long sequences of folds', () => {
      packets = generateLargePacketSequence(100, 500, packets, baselineCommitSha);

      foldEquivalentPackets({}, packets, prTimestamp);

      expect(_.every(packets, packet => {
        return packet.equivalentCommitShas.length === _.size(new Set(packet.equivalentCommitShas));
      }));
    });
    it('should not duplicate equivalent commits for packets folded onto a revision', () => {
      packets = generateLargePacketSequence(100, 500, packets, baselineCommitSha);
      foldEquivalentPackets({}, packets, prTimestamp);

      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});
      // fold redundant packets again so we can be sure we aren't duplicating equivalent commit
      // SHAs on a revision.
      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + 5);
      packets = generateLargePacketSequence(100, 500, packets, baselineCommitSha);
      foldEquivalentPackets(review, packets, prTimestamp);
      expect(_.size(review.revisions)).toEqual(lengthPriorToFolding + 5);
      expect(_.every(_.values(review.revisions).slice(5), rev =>
        rev.equivalentCommitShas.split(',').length ===
          _.size(new Set(rev.equivalentCommitShas.split(',')))
      )).toBeTruthy();
    });
  });

  describe('test makeAuthorLink', () => {
    it('should not error', () => {
      const candidate = review.revisions.r1;
      const packet: Partial<MockPacket> = {
        headCommit: {
          sha: candidate.commitSha,
          commit: _.find(candidate.commits, {sha: candidate.commitSha}),
          author: {}
        },
        author: candidate.author,
        commits: candidate.commits
      };
      makeAuthorLink(packet.headCommit);
    });
  });

  describe('test rebased file revisions show critical diff', () => {
    it('should show diff if rebased file is modfied & previous fileRev is modified to base', () => {
      _.forEach(review.revisions, (rev, key) => {
        _.forEach(review.files, file => {
          if (!file.revisions[key] || key === 'r1') {
            file.revisions[key] = {
              action: 'modified',
              fileSha: baselineFileSha + 'A',
              baselineFileSha
            };
          } else {
            file.revisions[key].action = 'modified';
          }
        });
      });
      packets = mockRebasedPackets(packets);
      _.forEach(packets, packet => {
        snapshotRevision(review, packet, commits, prTimestamp);
      });
      const rebasedRevisions = _.filter(review.revisions, 'priorRevisionKey');
      expect(_.every(rebasedRevisions, (rev, index) => {
        const adjustedIndex = index + 6;
        return _.every(review.files, file => {
          const rebasedFileRev = file.revisions[rev.priorRevisionKey];
          if (!rebasedFileRev?.action || rebasedFileRev?.action !== 'modified') return true;
          return doesRebaseShowCriticalDiff(file.revisions, adjustedIndex, rev);
        });
      }));
    });
  });

  describe('review respects forcing final reverted revisions', () => {
    it('should capture a reverted revision if previous revision head and base differ', () => {
      review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r5 =
        {baseFileSha: 'chg123', fileSha: baselineFileSha, action: 'modified'};
      const lastPacket = packets[4];
      lastPacket.fileShas['astropy/coordinates/angle_utilities.py'].base = baselineFileSha;
      lastPacket.fileShas['astropy/coordinates/angle_utilities.py'].head = baselineFileSha;
      _.forEach([lastPacket], packet => {snapshotRevision(review, packet, commits, prTimestamp);});

      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions).toHaveProperty('r6');
      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r6.action).toEqual('forced');
    });
    it('should not force an unnecessary reverted revision', () => {
      review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r5 =
        {baseFileSha: baselineFileSha, fileSha: baselineFileSha, action: 'modified'};
      // Packets are generated using review file SHAs -- last packet inherits last revision's SHAs
      packets = mockPacketFiles();
      const lastPacket = packets[4];
      _.forEach([lastPacket], packet => {snapshotRevision(review, packet, commits, prTimestamp);});

      // 5th file revision should be reverted to base, but we shouldn't force a 6th.
      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions).not.toHaveProperty('r6');
      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r5.action).not.toEqual('forced');
      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r5.action).toEqual('modified');
    });
    it('should not force a revision once a file exits the review', () => {
      // File has 5 revisions and should force a 6th, but not any subsequent revisions.
      review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r5 =
        {baseFileSha: 'chg123', fileSha: baselineFileSha, action: 'modified'};
      const lastPacket = packets[4];
      lastPacket.fileShas['astropy/coordinates/angle_utilities.py'].base = baselineFileSha;
      lastPacket.fileShas['astropy/coordinates/angle_utilities.py'].head = baselineFileSha;
      packets = _.fill(new Array(10), lastPacket);
      _.forEach(packets, packet => {snapshotRevision(review, packet, commits, prTimestamp);});

      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions).toHaveProperty('r6');
      expect(review.files['-JWYyFoweysTVBd0Yv_1'].revisions.r6.action).toEqual('forced');
      expect(_.keys(review.files['-JWYyFoweysTVBd0Yv_1'].revisions)).toHaveLength(6);
    });
  });

  describe('matching packets with prior revisions if rebased', () => {
    it('should match if change-Ids match perfectly for all commits', () => {
      const revKey = 'r2';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should ignore matching commits that share same author and date with blacklisted ' +
        'authorTimestamp and authorKey', () => {
      const revKey = 'r4';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      const authorDate = new Date();
      const authorId = 123442;
      packets[0].commits[0].commit.author.date = authorDate.toISOString();
      packets[0].commits[1].commit.author.date = authorDate.toISOString();
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      _.forEach(clonedReview.revisions[revKey].commits, (commit, commitKey) => {
        commit.authorTimestamp = authorDate.getTime();
        commit.authorKey = `github:${authorId}`;
        commit.title = 'This is message ' + commitKey;
      });
      packets.push({commits: [generateMockedPacketCommit('some message', Date.now(), 123321)]});
      packets[1].commits.push(
        generateMockedPacketCommit('some message', Date.now() + 1000, 123321)
      );
      setRevisionCommits(clonedReview.revisions.r3, packets[1]);
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBeFalsy();
      expect(packets[1].priorRevisionKey).toBe('r3');
    });

    it('should match if there is no change-Id ' +
        'but there is a matching authorTimestamp and authorKey', () => {
      const revKey = 'r2';
      const clonedReview = _.cloneDeep(review);
      packets = preparePackets();
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should NOT match if titles do not match ' +
        'and if either authorKey and authorTimestamp do not match', () => {
      const revKey = 'r2';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      packets[0].commits[0].commit.message = 'now a completely different title';
      packets[0].commits[0].commit.author.date = new Date().toISOString();
      packets[0].commits[1].commit.message = 'and the second title to add';
      packets[0].commits[1].author.id = 4320324;
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBeFalsy();
    });

    it('should match if titles match but the authorTimestamp and authorKey do not match', () => {
      const revKey = 'r2';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      let i = 0;
      _.forEach(clonedReview.revisions[revKey].commits, commit => {
        commit.authorTimestamp = Date.now() + (i * 1000);
        commit.authorKey = 'github:123234';
        i++;
      });
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should match if neither authorKeys or authorTimestamps match ' +
        'but titles nearly matches', () => {
      const revKey = 'r2';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      delete clonedReview.revisions[revKey].commits.c1;
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      clonedReview.revisions[revKey].commits.c0.authorTimestamp = Date.now();
      clonedReview.revisions[revKey].commits.c0.authorKey = 'github:1379802';
      clonedReview.revisions[revKey].commits.c0.changeId = null;
      clonedReview.revisions[revKey].commits.c0.title = 'thre file uptaded';
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should match if more than half the commits match ' +
        'from the revision and the distance is 2', () => {
      const revKey = 'r4';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      clonedReview.revisions[revKey].commits.c2 = {
        authorKey: 'github:898898',
        authorTimestamp: Date.now(),
        title: 'This is a new title'
      };
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should match if more than half the commits match ' +
        'from packet and the distance is 2', () => {
      const revKey = 'r4';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      packets[0].commits.push(
        generateMockedPacketCommit('This is a new message!', new Date().toISOString(), 122324)
      );

      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should NOT match when commits are over 100 and titles ' +
        'or authorTimestamp/authorKey do NOT exactly match', () => {
      const revKey = 'r4';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      for (let i = 1; i <= 50; i++) {
        packets[0].commits.push(
          generateMockedPacketCommit(
            `This is message ${i}!`, new Date(Date.now() + (i * 1000)).toISOString(), 122324
          )
        );
      }
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
        setRevisionCommits(clonedReview.revisions[revKey], packet);
        _.forEach(packet.commits, (commit, i: number) => {
          commit.commit.message += i;
          commit.author.id = 32322 + i;
          commit.commit.author.date = new Date().toISOString();
        });
      });
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBeFalsy();
    });

    it('should match when commits are over 100 ' +
        'and titles or authorTimestamp/authorKey do exactly match', () => {
      const revKey = 'r2';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      for (let i = 1; i <= 50; i++) {
        packets[0].commits.push(
          generateMockedPacketCommit(
            `This is message ${i}!`, new Date(Date.now() + (i * 1000)).toISOString(), 122324
          )
        );
      }
      _.forEach(packets, packet => {
        setRevisionCommits(clonedReview.revisions[revKey], packet);
        _.forEach(packet.commits, (commit, i: number) => {
          commit.commit.message += i;
        });
      });
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe(revKey);
    });

    it('should match the revision at the closest distance ' +
        'when all commits are NOT an exact match but have similar scores', () => {
      packets = preparePackets();
      packets.push(...preparePackets());
      packets.push(...preparePackets());
      packets.push(...preparePackets());
      _.forEach(packets, packet => {
        while (packet.commits.length > 1) {
          packet.commits.pop();
        }
      });
      const clonedReview = _.cloneDeep(review);
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      clonedReview.revisions = {};
      clonedReview.revisions.r1 = generateMockedRevision(4);
      setObsoleteFlag(clonedReview.revisions, ['r5']);
      _.forEach(packets, (packet, i) => {
        const commit = clonedReview.revisions.r1.commits[`c${i}`];
        packet.commits[0] = generateMockedPacketCommit(
          commit.title, new Date(commit.authorTimestamp).toISOString(), 1223704
        );
      });
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBe('r1');
    });

    it('should NOT match when multiple packets match to the same revision', () => {
      const revKey = 'r4';
      packets = preparePackets();
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, 'r5');
      _.forEach(packets, packet => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
        });
      });
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      packets.push(_.cloneDeep(packets[0]));
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[0].priorRevisionKey).toBeFalsy();
      expect(packets[1].priorRevisionKey).toBeFalsy();
    });

    it('should NOT match when multiple packets match to the same revision', () => {
      const revKey = 'r2';
      packets = preparePackets();
      packets = _.concat(packets, [...preparePackets()]);
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, 'r5');
      _.forEach(packets, (packet, i: number) => {
        _.forEach(packet.commits, commit => {
          commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
          if (i === 1) {
            commit.commit.message = `This is a new message: ${i}`;
            commit.commit.author.date = Date.now();
            commit.author.id = 112312;
          }
        });
      });
      setRevisionCommits(clonedReview.revisions.r3, packets[1]);
      setRevisionCommits(clonedReview.revisions[revKey], packets[0]);
      clonedReview.revisions.r4.commits = _.cloneDeep(clonedReview.revisions[revKey].commits);
      clonedReview.revisions.r4.commits.c1.title = 'jfkdsaljkfldaa dsafd r4';
      clonedReview.revisions.r4.commits.c1.authorTimestamp = Date.now();
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[1].priorRevisionKey).toBeUndefined();
    });

    it('when two revisions potentially match and are considered ' +
        'the best match, neither of them should match', () => {
      packets = _.cloneDeep(largeMockPackets);
      const clonedReview = _.clone(review);
      clonedReview.revisions = _.cloneDeep(largeMockRevisions);
      inferPriorRevisionKeys(packets, clonedReview.revisions);
      expect(packets[1].priorRevisionKey).toBe('r2');
      expect(packets[2].priorRevisionKey).toBe('r3');
      expect(packets[3].priorRevisionKey).toBeFalsy();
    });

    it('when two revisions potentially match and are considered ' +
        'the best match, neither of them should match', () => {
      const firstPacket: any = _.cloneDeep(largeMockPackets[1]);
      const secondPacket: any = _.cloneDeep(largeMockPackets[0]);
      firstPacket.commits.push(secondPacket.commits[1]);
      firstPacket.commits.push(secondPacket.commits[2]);
      _.forEach(secondPacket.commits, commit => {
        commit.commit.message = commit.commit.message.replace(/\n[\s\S]*/, '');
      });
      const clonedReview = _.cloneDeep(review);
      setObsoleteFlag(clonedReview.revisions, 'r5');
      setRevisionCommits(clonedReview.revisions.r4, firstPacket);
      setRevisionCommits(clonedReview.revisions.r3, {
        ...secondPacket,
        commits: secondPacket.commits.slice(0, 3)
      });
      setRevisionCommits(clonedReview.revisions.r2,
        {
          ...secondPacket,
          commits: secondPacket.commits.slice(0, 4)
        }
      );
      inferPriorRevisionKeys([firstPacket, secondPacket], clonedReview.revisions);
      expect(firstPacket.priorRevisionKey).toBeFalsy();
      expect(secondPacket.priorRevisionKey).toBe('r2');
    });
  });
}


describe('test review folding algorithm', () => {
  test('review working', () => {
    expect(review).toHaveProperty('files');
  });
  mainTest(true);
  mainTest(false);
  mainTest('no author');
});
