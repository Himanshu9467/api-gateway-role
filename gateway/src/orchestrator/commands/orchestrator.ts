import { CommandParser } from "../parser/commandParser";
import { OnboardClientWorkflow } from "../workflows/onboardClient.workflow";

export class AiOrchestrator {
  constructor(
    private readonly parser: CommandParser,
    private readonly onboardClientWorkflow: OnboardClientWorkflow
  ) {}

  async run(input: unknown, requestId: string) {
    const command = this.parser.parse(input);

    switch (command.intent) {
      case "onboard_client":
        return this.onboardClientWorkflow.execute(command, requestId);
      default:
        throw new Error("Unsupported command intent");
    }
  }
}
