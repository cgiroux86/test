const REVIEWABLE_TEAM = ['github:59579733', 'github:1646896', 'github:1223704',
    'github:80698647', 'github:79605020'];
 query ($owner: String!, $repo: String!, $commitSha: GitObjectID!) {
repository(owner: $owner, repo: $repo, commitSha: $commitSha) {
    object(oid: $commitSha) {
      ... on Commit {
        parents(first: 100) {
          nodes {
            id
          }
        }
      }
    }
  }
    }