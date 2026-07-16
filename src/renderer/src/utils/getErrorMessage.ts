export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  if (typeof error === 'string' && error.trim() !== '') {
    return error
  }

  return "Une erreur inattendue s'est produite. Veuillez réessayer."
}
