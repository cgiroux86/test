iimport {readFileSync} from 'fs';
import path from 'path';
import _ from 'lodash';
import {
  foldEquivalentPackets, normalizeFileInfo, mergeEquivalentCandidateShas, normalizeRevisionFiles
} from '../github/pull_requests';

interface MockPacket {
    headCommit?: {sha: string};
    baseCommit?: {sha: string};
    fileShas?: any;
    commits?: any[];
    idx?: number;
}

const review = prepareReview();
const revKeys = _.sortBy(_.keys(review.revisions), key => +key.slice(1));
const lastKey = _.last(revKeys);

const sampleCommits = [
  {sha: '12345', commit: {committer: {date: Date.now()}, message: 'This is test message 1'}},
  {sha: '67890', commit: {committer: {date: Date.now()}, message: 'This is test message 2'}}
];

const secondaryCommits = [
  {sha: 'abcde', commit: {committer: {date: Date.now()}, message: 'This is test message 1'}},
  {sha: 'fghij', commit: {committer: {date: Date.now()}, message: 'This is test message 2'}}
];

function mockPacketFiles() {
  const lastObsoleteRevisionIndex = _.findLastIndex(revKeys, key => review.revisions[key].obsolete);
  if (lastObsoleteRevisionIndex >= 0) revKeys.splice(0, lastObsoleteRevisionIndex + 1);
  return _.map(revKeys, key => {
    const fileInfo = _(review.files)
      .reject(file => !file.revisions[key])
      .keyBy('path')
      .mapValues(file => normalizeFileInfo(file.revisions[key]))
      .value();
    const newPacket: MockPacket = {};
    newPacket.headCommit = {sha: review.revisions[key].commitSha};
    newPacket.baseCommit = {sha: review.revisions[key].baseCommitSha};
    newPacket.fileShas = fileInfo;
    newPacket.commits = sampleCommits;
    return newPacket;
  });
}

function serializeCommitShas(commits) {
  return _.reduce(
    _.values(commits), (curr, commit) => curr + commit.sha, ''
  );
}

function prepareReview() {
  // possible this may need to be normalized for windows
  const file = path.join(__dirname, '../demo_review.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('test review folding algorithm', () => {
  let packets;
  beforeEach(() => {
    packets = mockPacketFiles();
  });

  test('review working', () => {
    expect(review).toHaveProperty('files');
  });

  describe('does not fold onto revisions', () => {
    it('should not fold revisions onto eachother', () => {
      const revs = normalizeRevisionFiles(review), length = revs.length;
      foldEquivalentPackets(revs, []);
      expect(revs).toHaveLength(length);
    });
  });

  describe('folds single end packet correctly', () => {
    it('should match the last revision if packet is the same', () => {
      const firstPacket = [_.last(packets)];
      foldEquivalentPackets(review, firstPacket);
      expect(firstPacket).toHaveLength(0);
    });
    it('should not match the last revision if packet is different', () => {
      const lastPacket = [_.head(packets)];
      foldEquivalentPackets(review, lastPacket);
      expect(lastPacket).toHaveLength(1);
    });
  });

  describe('folds various sequences correctly', () => {
    /* eslint-disable max-len */
    it('should fold down to 2 packets if first packet differs from last rev and remaining packets are equivalent', () => {
    /* eslint-enable max-len */
      const front = packets.slice(0, 2), end = packets.slice(4);
      const newPackets = end.concat(front).concat(front);
      foldEquivalentPackets(review, newPackets);
      expect(newPackets).toHaveLength(2);
    });
    it('should fold long sequences correctly', () => {
      foldEquivalentPackets(review, packets);
      expect(packets).toHaveLength(0);
    });
    it('should partially fold long sequences correctly', () => {
      const frontPackets = packets.slice(0, 2);
      const midPackets = packets.slice(2, 4);
      const endPackets = packets.slice(4);
      const endsAreSame = endPackets.concat(endPackets).concat(midPackets);
      const endsAreDifferent = midPackets.concat(frontPackets).concat(endPackets);
      foldEquivalentPackets(review, endsAreSame);
      foldEquivalentPackets(review, endsAreDifferent);
      expect(endsAreSame).toHaveLength(2);
      expect(endsAreDifferent).toHaveLength(5);
    });
  });

  describe('merge commits correctly', () => {
    it('should fold first packets commits onto last revision', () => {
      foldEquivalentPackets(review, packets);
      expect(serializeCommitShas(review.revisions[lastKey].commits)).toEqual('1234567890');
    });
    it('should fold a full sequential match commits correctly', () => {
      foldEquivalentPackets(review, packets);
      const serializedCommits = _(review.revisions).mapValues(rev =>
        serializeCommitShas(rev.commits)).reduce((str, sha) => str + sha);
      expect(serializedCommits).toEqual(_.repeat('1234567890', _.size(review.revisions)));
    });
    it('should not fold first packet commits if idx is smaller (earlier in sequence)', () => {
      const firstPacket: MockPacket = _.head(packets);
      firstPacket.idx = 1;
      const lastRevision: any = _.last(normalizeRevisionFiles(review));
      lastRevision.idx = Infinity;
      mergeEquivalentCandidateShas(lastRevision, {packet: firstPacket});
      expect(serializeCommitShas(lastRevision)).not.toEqual('1234567890');
      const secondPacket: MockPacket = _.last(packets);
      secondPacket.idx = 0;
      secondPacket.commits = secondaryCommits;
      mergeEquivalentCandidateShas(firstPacket, {packet: secondPacket});
      expect(serializeCommitShas(firstPacket).match(serializeCommitShas(secondPacket))).toBeFalsy();
    });
  });
});

