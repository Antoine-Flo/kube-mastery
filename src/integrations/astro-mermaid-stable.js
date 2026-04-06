import astroMermaid from 'astro-mermaid'

const RENDER_CALL = 'const { svg } = await mermaid.render(id, diagramDefinition);'
const STABLE_RENDER_CALL =
  'const { svg } = await mermaid.render(id, diagramDefinition, diagram);'

export default function astroMermaidStable(options = {}) {
  const baseIntegration = astroMermaid(options)
  const setupHook = baseIntegration?.hooks?.['astro:config:setup']

  if (!setupHook) {
    return baseIntegration
  }

  return {
    ...baseIntegration,
    hooks: {
      ...baseIntegration.hooks,
      'astro:config:setup': async (context) => {
        const originalInjectScript = context.injectScript
        const wrappedContext = {
          ...context,
          injectScript: (stage, content) => {
            if (
              typeof content === 'string' &&
              content.includes(RENDER_CALL) &&
              !content.includes(STABLE_RENDER_CALL)
            ) {
              return originalInjectScript(
                stage,
                content.replace(RENDER_CALL, STABLE_RENDER_CALL)
              )
            }
            return originalInjectScript(stage, content)
          }
        }

        return setupHook(wrappedContext)
      }
    }
  }
}
