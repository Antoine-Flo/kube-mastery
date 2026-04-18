export const splitYamlDocuments = (yamlContent: string): string[] => {
  const documents = yamlContent.split(/^---\s*$/m)
  return documents.filter((doc) => {
    return doc.trim().length > 0
  })
}
