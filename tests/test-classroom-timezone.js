const { assert, read } = require('./_security-baseline-helpers');

const dateTime = read('lib/date-time.ts');
const classroom = read('lib/google-classroom.ts');
const publishRoute = read('app/api/classroom/courses/[courseId]/coursework/[courseWorkId]/route.ts');

assert(
  dateTime.includes('buildClassroomDueFieldsFromManilaInput') && dateTime.includes('formatClassroomDueDateTime'),
  'Classroom due-date helpers should preserve Manila wall time for both writes and reads.'
);

assert(
  classroom.includes('buildClassroomDueFieldsFromManilaInput') && classroom.includes('publishClassroomCourseWork'),
  'Classroom adapter should normalize due fields and expose a publish helper for officer drafts.'
);

assert(
  publishRoute.includes('publishClassroomCourseWork') && publishRoute.includes('hasOfficerPrivilege') && publishRoute.includes('CourseWorkIdSchema'),
  'Officer publish route should stay guarded and wired to the shared Classroom publish helper.'
);

console.log('test-classroom-timezone: PASS');