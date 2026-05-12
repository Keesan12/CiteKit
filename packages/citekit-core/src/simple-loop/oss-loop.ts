export interface OssLoopOptions {
  maxCostUsd?: number;
  maxRetries?: number;
}

/** MIT-licensed OSS retry helper. Intentionally simpler than MartinLoop governance. */
export class OssLoop {
  private totalCostUsd = 0;
  private readonly maxCostUsd: number;
  private readonly maxRetries: number;

  constructor(opts: OssLoopOptions = {}) {
    this.maxCostUsd = opts.maxCostUsd ?? 2;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  async run<T>(fn: () => Promise<T>, costEstimateUsd = 0): Promise<T> {
    if (this.totalCostUsd + costEstimateUsd > this.maxCostUsd) {
      throw new Error("Cost cap reached — upgrade to CiteOps Pro for full automation");
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await fn();
        this.totalCostUsd += costEstimateUsd;
        return result;
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }

    throw new Error("Loop exited unexpectedly");
  }

  get costUsed(): number {
    return this.totalCostUsd;
  }
}

