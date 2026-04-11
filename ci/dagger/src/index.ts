// @ts-nocheck
import { dag, Directory, func, object, Secret } from '@dagger.io/dagger'

@object()
export class KubeMasteryCi {
  private qualityGate(source: Directory, cloudflareEnv?: string) {
    let container = dag
      .container()
      .from('node:22')
      .withDirectory('/src', source)
      .withWorkdir('/src')

    if (cloudflareEnv != null && cloudflareEnv !== '') {
      container = container.withEnvVariable('CLOUDFLARE_ENV', cloudflareEnv)
    }

    return container
      .withExec(['npm', 'ci'])
      .withExec(['npm', 'run', 'check'])
      .withExec(['npm', 'run', 'test'])
      .withExec(['npm', 'run', 'build'])
  }

  @func()
  testAndBuild(source: Directory): Directory {
    return this.qualityGate(source).directory('/src/dist')
  }

  private deployContainer(
    source: Directory,
    cloudflareAccountId: string,
    cloudflareApiToken: Secret,
    cloudflareEnv?: string
  ) {
    let container = this.qualityGate(source, cloudflareEnv)
      .withExec(['npx', '--yes', 'wrangler', '--version'])
      .withEnvVariable('CLOUDFLARE_ACCOUNT_ID', cloudflareAccountId)
      .withSecretVariable('CLOUDFLARE_API_TOKEN', cloudflareApiToken)

    if (cloudflareEnv != null && cloudflareEnv !== '') {
      container = container.withEnvVariable('CLOUDFLARE_ENV', cloudflareEnv)
    }

    return container
  }

  @func()
  async deployStaging(
    source: Directory,
    cloudflareAccountId: string,
    cloudflareApiToken: Secret
  ): Promise<string> {
    return this.deployContainer(
      source,
      cloudflareAccountId,
      cloudflareApiToken,
      'staging'
    )
      .withExec(['npx', '--yes', 'wrangler', 'deploy', '--env', 'staging'])
      .stdout()
  }

  @func()
  async deployProduction(
    source: Directory,
    cloudflareAccountId: string,
    cloudflareApiToken: Secret
  ): Promise<string> {
    return this.deployContainer(source, cloudflareAccountId, cloudflareApiToken)
      .withExec(['npx', '--yes', 'wrangler', 'deploy'])
      .stdout()
  }
}
