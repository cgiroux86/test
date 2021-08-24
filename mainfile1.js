const { readFileSync } = require("fs");
const _ = require('lodash');

function _syntheticCommitShasDifferFromRevisionCommitShas(file, revKey) {
      const lastParsedCommitSha = _(file.matchAll(/^\n- (\w{7}):(.*?)$/gm))
        .toArray()
        .last()[1]
      console.log('LAST SHA ->', lastParsedCommitSha);
      return lastParsedCommitSha !== ~this.review.revisions[revKey].commitSha.slice(0, 7);
    }

const file1 = readFileSync('./file.txt', 'utf-8')
const file2 = readFileSync('./file2.txt', 'utf-8')
console.log('FILE 1!', file1);
_syntheticCommitShasDifferFromRevisionCommitShas(file1, 'r1');