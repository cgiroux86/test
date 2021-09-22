function transformDate (date) {
  const newDate = date.replace(
          /^(New commits in r\d+) at (\d{4}-\d\d-\d\d \d\d:\d\d:\d\dZ)/, (match, prefix, zdate) => {
            const date = new Date(zdate);
            console.log('THE DATE: ', date);
            if (isNaN(date)) {
              console.log('INVALID DATE FORMAT!')
              return match;
            }
            return prefix + ' on ' + date.toLocaleDateString() +
              ' at ' + date.toLocaleTimeString([], {timeStyle: 'short'});
          }
        )
    return newDate
}

const date = "New commits in r2 at 2021-09-08 11:37:41Z:\n- 4b11af0: Apply suggestions from code review\n\n  Co-authored-by: Frans de Jonge <fransdejonge@gmail.com>\n"
const secondDate = "New commits in r1 at 2021-09-07 12:56:35Z:\n- d3575bf: Style tweaks: add a few ruby specific tweaks\n"
const thirdDate = "New commits in r3 at 2021-09-06 17:32:01Z"

console.log('TRANSFORMED 1: ', transformDate(date));
console.log('TRANSFORMED 2: ', transformDate(secondDate));
