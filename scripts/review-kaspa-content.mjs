// Reviews are recorded per item. This entrypoint verifies content without
// overwriting evidence, dates, concepts, or marking imports source-checked.
import { checkQuestionBanks } from './check-question-banks.mjs';
console.log(JSON.stringify(checkQuestionBanks()));
