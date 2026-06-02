import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "../config/env";

export interface SecretProvider {
  load(): Promise<Record<string, string>>;
}

export class EnvironmentSecretProvider implements SecretProvider {
  async load(): Promise<Record<string, string>> {
    return process.env as Record<string, string>;
  }
}

export class AwsSecretsManagerProvider implements SecretProvider {
  private readonly client = new SecretsManagerClient({ region: env.AWS_SECRETS_REGION });

  async load(): Promise<Record<string, string>> {
    if (!env.AWS_SECRETS_JSON_ID) return {};
    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: env.AWS_SECRETS_JSON_ID })
    );
    if (!response.SecretString) return {};
    const parsed = JSON.parse(response.SecretString) as Record<string, string>;
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
    return parsed;
  }
}

export function createSecretProvider(): SecretProvider {
  return env.SECRET_PROVIDER === "aws" ? new AwsSecretsManagerProvider() : new EnvironmentSecretProvider();
}

export async function validateStartupSecrets(provider = createSecretProvider()): Promise<void> {
  await provider.load();
  const required = ["JWT_SECRET", "DATABASE_URL", "REDIS_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(", ")}`);
  }
}
