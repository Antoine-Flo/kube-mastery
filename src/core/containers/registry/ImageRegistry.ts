import { error, success, type Result } from '../../shared/result'
import { SEED_IMAGES, type ImageManifest } from './seedRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER IMAGE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
// Manages available container images with validation and parsing.

interface ParsedImage {
    name: string
    registry: string
    tag: string
}

export interface ImageRegistry {
    parseImageString: (imageString: string) => Result<ParsedImage>
    validateImage: (imageString: string) => Result<ImageManifest>
    getImage: (name: string, tag?: string) => Result<ImageManifest>
    listAllImages: () => ImageManifest[]
}

export const createImageRegistry = (): ImageRegistry => {
    const images = SEED_IMAGES

    const parseImageString = (imageString: string): Result<ParsedImage> => {
        if (!imageString || imageString.trim() === '') {
            return error('Image name cannot be empty')
        }

        const trimmed = imageString.trim()

        // Check for obviously invalid format
        if (trimmed.includes('::') || trimmed.startsWith(':') || trimmed.endsWith(':')) {
            return error('Invalid image format')
        }

        // Parse format: [registry/]name[:tag]
        let registry = 'docker.io/library'
        let nameWithTag = trimmed
        let name = ''
        let tag = 'latest'

        // Check if registry is specified (contains / before any :)
        const firstSlash = trimmed.indexOf('/')
        const firstColon = trimmed.indexOf(':')

        if (firstSlash !== -1 && (firstColon === -1 || firstSlash < firstColon)) {
            // Registry is specified
            registry = trimmed.substring(0, firstSlash)
            nameWithTag = trimmed.substring(firstSlash + 1)
        }

        // Split name and tag
        const colonIndex = nameWithTag.indexOf(':')
        if (colonIndex !== -1) {
            name = nameWithTag.substring(0, colonIndex)
            tag = nameWithTag.substring(colonIndex + 1)
        } else {
            name = nameWithTag
        }

        if (!name) {
            return error('Invalid image format: missing image name')
        }

        return success({ name, registry, tag })
    }

    const validateImage = (imageString: string): Result<ImageManifest> => {
        const parseResult = parseImageString(imageString)

        if (!parseResult.ok) {
            return parseResult
        }

        const parsed = parseResult.value

        // Find image in registry
        const image = images.find(
            (img) => img.name === parsed.name && img.registry === parsed.registry
        )

        if (!image) {
            return error(
                `Image not found in registry.\n\nRun 'debug images' to see available images.`
            )
        }

        // Check if tag exists
        if (!image.tags.includes(parsed.tag)) {
            const availableTags = image.tags.join(', ')
            return error(
                `Tag '${parsed.tag}' not found for ${image.name}\n\nAvailable tags: ${availableTags}`
            )
        }

        return success(image)
    }

    const getImage = (name: string, tag: string = 'latest'): Result<ImageManifest> => {
        // Try to find in all registries
        const image = images.find((img) => img.name === name)

        if (!image) {
            return error(`Image '${name}' not found in registry`)
        }

        // Check tag
        if (!image.tags.includes(tag)) {
            const availableTags = image.tags.join(', ')
            return error(`Tag '${tag}' not found for ${name}\n\nAvailable tags: ${availableTags}`)
        }

        return success(image)
    }

    const listAllImages = (): ImageManifest[] => {
        return [...images]
    }

    return {
        parseImageString,
        validateImage,
        getImage,
        listAllImages,
    }
}

