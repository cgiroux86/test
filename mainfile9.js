
console.log('This is the main test file new!!!!');


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



  this.$when(() => ~this.review.core.ownerName && ~this.review.core.repoName).then(() => {
    const core = this.review.core;
    return this.$meta.user ?
      this.$store.services.completions.labels.fetch(core.ownerName, core.repoName) :
      this.$store.services.completions.labels.fetchAnonymous(core.ownerName, core.repoName);
  });