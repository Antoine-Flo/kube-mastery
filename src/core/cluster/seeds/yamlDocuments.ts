export const splitYamlDocuments = (yamlContent: string): string[] => {
  // Accept standard YAML document separators with trailing content
  // such as comments (`--- # note`) or tags (`--- !tag`).
  const documents = yamlContent.split(/^---(?:[ \t]+.*)?$/m)
  return documents.filter((doc) => {
    return doc.trim().length > 0
  })
}
