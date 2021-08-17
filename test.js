function location(linemaps) {
      const commitSha = ~this.review.revisions[this.targetRevisionKey]
          [this.targetRevisionBase ? 'baseCommitSha' : 'commitSha'];
      const location = {line: this.line, accuracy: 1, commitSha};
      console.log("LOCATION ->", location, this.line, this.sourceRevisionKey, this.targetRevisionKey, this._spec);
      if (this._identity) return location;
      if (!this._spec) return;
      if (this._spec.error ||
          _.some(this._spec.linemapSpecs, linemapSpec =>
            !linemapSpec.leftSha || !linemapSpec.rightSha
          )
      ) {
        return {line: 0, accuracy: 0, commitSha};
      }
      const spec = this._spec;
      return Promise.all(
        _.map(spec.linemapSpecs, linemapSpec => this.diff.getLinemap(linemapSpec))
      ).then(intermediateLinemaps => {
        if (this.$destroyed || spec !== this._spec) return;
        let sign = spec.sign;
        console.log("LINEMAPS ->", intermediateLinemaps);
        _.forEach(intermediateLinemaps, (linemap, i) => {
          console.log("LINEMAP ->", linemap);
          if (!location.line) return false;
          if (spec.flipLastSign && i === intermediateLinemaps.length - 1) sign = -sign;
          const direction = sign === 1 ? 'leftToRight' : 'rightToLeft';
          const sourceSide = sign === 1 ? 'left' : 'right';
          const targetSide = sign === 1 ? 'right' : 'left';
          const block = linemap[direction][_.sortedIndexBy(
            linemap[direction], location.line,
            entry => _.isNumber(entry) ? entry : entry[sourceSide + 'End']
          )];
          console.log("BLOCK ->", block);
          if (!block) {
            const error = new Error('Missing block when mapping line');
            error.extra = {
              step: i + 1, numSteps: intermediateLinemaps.length, direction, location
            };
            throw error;
          }
          switch (block.type) {
            case 'bottom': location.line = block[targetSide + 'End']; break;
            case 'bijection':
              location.line =
                location.line - block[sourceSide + 'Start'] + block[targetSide + 'Start'];
              break;
          }
          location.accuracy *= block.accuracy;
        });
        return location;
      }).catch(error => {
        if (error.message !== 'Canceled') {
          this._decorateError(error);
          corpsman.capture(error, 'Mapping.location');
        }
        return {line: 0, accuracy: 0, commitSha};
      });
    }