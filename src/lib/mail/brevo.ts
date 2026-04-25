import { BrevoClient } from '@getbrevo/brevo'
import { readAppEnv } from '../env'

const BREVO_LIST_ID = 6

interface BrevoContact {
  email: string
  name?: string
}

/**
 * Adds a new user to the Brevo contacts list.
 * Silently no-ops if BREVO_API_KEY is absent.
 * Errors are swallowed: contact sync must never block the signup response.
 */
export async function addContactToBrevo(
  locals: unknown,
  contact: BrevoContact
): Promise<void> {
  const apiKey = readAppEnv('BREVO_API_KEY', locals)
  if (apiKey == null) {
    return
  }

  const brevo = new BrevoClient({ apiKey })

  const attributes: Record<string, string> = {}
  if (contact.name != null) {
    attributes['FIRSTNAME'] = contact.name
  }

  try {
    await brevo.contacts.createContact({
      email: contact.email,
      attributes,
      listIds: [BREVO_LIST_ID],
      updateEnabled: true
    })
  } catch {
    // Non-critical: contact sync failure must not block signup
  }
}
