import crypto from 'crypto'

/**
 * Computes a SHA-256 checksum over a sequence of key/value pairs.
 * Returns a base64url-encoded digest string.
 */
export function checksum(entries: [string, string | undefined][]): string {
	const hash = crypto.createHash('sha256')
	for (const [key, value] of entries) {
		hash.update(`${key}=${value ?? ''}\n`)
	}
	return hash.digest('base64url')
}
