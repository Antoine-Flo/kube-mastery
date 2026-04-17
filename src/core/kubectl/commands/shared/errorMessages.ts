export const buildNotFoundErrorMessage = (
  resourceReference: string,
  name: string
): string => {
  return `Error from server (NotFound): ${resourceReference} "${name}" not found`
}

const withOptionalErrorPrefix = (
  message: string,
  withErrorPrefix: boolean
): string => {
  if (withErrorPrefix) {
    return `error: ${message}`
  }
  return message
}

export const buildRequiresResourceTypeMessage = (
  command: string,
  withErrorPrefix = true
): string => {
  return withOptionalErrorPrefix(
    `${command} requires a resource type`,
    withErrorPrefix
  )
}

export const buildRequiresResourceNameMessage = (
  command: string,
  withErrorPrefix = true
): string => {
  return withOptionalErrorPrefix(
    `${command} requires a resource name`,
    withErrorPrefix
  )
}

export const buildRequiresSubcommandMessage = (
  command: string,
  withErrorPrefix = true
): string => {
  return withOptionalErrorPrefix(`${command} requires a subcommand`, withErrorPrefix)
}

export const buildUnsupportedSubcommandMessage = (
  command: string,
  subcommand: string,
  withErrorPrefix = true
): string => {
  return withOptionalErrorPrefix(
    `unsupported ${command} subcommand "${subcommand}"`,
    withErrorPrefix
  )
}

export const buildRequiresFilenameFlagMessage = (
  command: string,
  withErrorPrefix = false
): string => {
  return withOptionalErrorPrefix(
    `${command} requires one of -f or --filename`,
    withErrorPrefix
  )
}

export const buildRequiredFlagNotSetMessage = (
  flagName: string
): string => {
  return `error: required flag(s) "${flagName}" not set`
}

export const buildMustSpecifyFilenameFlagMessage = (): string => {
  return 'error: must specify one of -f or --filename'
}
