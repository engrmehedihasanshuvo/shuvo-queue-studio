export interface QueueTask {
  id: string;
  prompt: string;
  status: "pending" | "running" | "done" | "failed";
  output?: string;
  error?: string;
}

export class TaskQueue {
  private tasks: QueueTask[] = [];
  private running = false;

  add(prompt: string): QueueTask {
    const task: QueueTask = {
      id: crypto.randomUUID(),
      prompt,
      status: "pending",
    };
    this.tasks.push(task);
    return task;
  }

  getAll(): QueueTask[] {
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }

  isRunning(): boolean {
    return this.running;
  }

  async runSequentially(executor: (task: QueueTask) => Promise<string>): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      for (const task of this.tasks) {
        if (task.status !== "pending") {
          continue;
        }

        task.status = "running";
        try {
          task.output = await executor(task);
          task.status = "done";
        } catch (error) {
          task.error = error instanceof Error ? error.message : String(error);
          task.status = "failed";
        }
      }
    } finally {
      this.running = false;
    }
  }
}
