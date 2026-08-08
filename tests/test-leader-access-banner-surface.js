const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const homeSource = read('app/page.tsx');
assertContainsOneOf(
  homeSource,
  [/LeaderAccessNoticeBanner/],
  'home page should render dedicated leader-access callback banner.'
);

const servicesSource = read('app/services/page.tsx');
assertContainsOneOf(
  servicesSource,
  [/LeaderAccessNoticeBanner/],
  'services page should render dedicated leader-access callback banner.'
);

const hubSource = read('app/hub/page.tsx');
assertContainsOneOf(
  hubSource,
  [/LeaderAccessNoticeBanner/, /guideLooksLeaderOnly/],
  'hub should include callback banner or role-tiered guide visibility filtering.'
);

console.log('test-leader-access-banner-surface: PASS');
