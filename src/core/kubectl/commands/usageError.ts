/**
 * Shapes kubectl cmdutil.UsageErrorf-style messages:
 * error line + See '<commandPath> -h' for help and examples.
 * @see refs/k8s/kubectl/pkg/cmd/util/helpers.go (UsageErrorf)
 */

export const kubectlUsageError = (
  commandPath: string,
  message: string
): string => {
  return `error: ${message}\nSee '${commandPath} -h' for help and examples`
}

export const kubectlUnexpectedArgsUsageError = (
  commandPath: string,
  args: readonly string[]
): string => {
  return kubectlUsageError(
    commandPath,
    `Unexpected args: [${args.join(' ')}]`
  )
}
