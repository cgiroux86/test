console.log('This is the main test file new777!!!!!');

const IMAGE_SIZE_QUERY = `
query ($owner: String!, $repo: String!, $sha: GitObjectID!) {
  repository (owner: $owner, name: $repo) {
    object (oid: $sha) {
      ... on Blob {
        byteSize
      }
    }
  }
}
`;
