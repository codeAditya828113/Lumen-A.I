import { conductResearch } from './src/services/gemini.js';
import * as dotenv from 'dotenv';
dotenv.config();

// We need to inject the mock or let it run
async function run() {
  try {
    const res = await conductResearch('Google Cloud Run');
    console.log(Object.keys(res));
  } catch (e) {
    console.error(e);
  }
}
run();
