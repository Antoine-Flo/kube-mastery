import type { ParsedCommand } from '../types'
import { getOfficialHelpForCommandPath } from '../../cli/descriptions/officialHelpCatalog'

export const handleOptions = (_parsed: ParsedCommand): string => {
  return getOfficialHelpForCommandPath(['options']) ?? ''
}
