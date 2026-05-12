import { benchmarkFoundation } from "citekit-core";

const result = await benchmarkFoundation({
  name: "Example",
  domain: "example.com",
});

console.log({
  overall: result.scores.overall,
  metrics: result.metrics,
  topActions: result.topActions,
});
