import { completedYears, memberDate } from '../src/shared/membership.ts';

const joined = Date.UTC(2023, 3, 25);
const later = Date.UTC(2026, 9, 23);
if (completedYears(joined, later) !== 3) {
  console.error('expected 3 completed years');
  process.exit(1);
}
if (completedYears(joined, Date.UTC(2024, 3, 24)) !== 0) {
  console.error('day before anniversary should be 0');
  process.exit(1);
}
if (completedYears(joined, Date.UTC(2024, 3, 25)) !== 1) {
  console.error('anniversary day should be 1');
  process.exit(1);
}
const label = memberDate(joined);
if (!label.includes('2023') || !label.includes('Apr')) {
  console.error('date label', label);
  process.exit(1);
}
console.log(JSON.stringify({ years: 3, label }));
