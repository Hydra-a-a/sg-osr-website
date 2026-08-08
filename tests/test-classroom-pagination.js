const { assert, read } = require('./_security-baseline-helpers');

const classroom = read('lib/google-classroom.ts');

assert(
  classroom.includes('pageToken') && classroom.includes('nextPageToken'),
  'Classroom helpers should paginate course and coursework reads instead of stopping at the first page.'
);

assert(
  classroom.includes('collectCourses') || classroom.includes('while (pageToken)') || classroom.includes('do {'),
  'Classroom course loading should iterate through all pages.'
);

assert(
  classroom.includes('listCourseWork') && classroom.includes('while (pageToken)') && classroom.includes('courseWork.list'),
  'Classroom coursework loading should iterate through all pages.'
);

console.log('test-classroom-pagination: PASS');