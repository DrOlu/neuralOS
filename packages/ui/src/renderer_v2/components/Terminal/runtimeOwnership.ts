export const isRuntimeOwnedByUi = (ownershipCheck?: (() => boolean) | null): boolean => {
  if (!ownershipCheck) return true
  try {
    return ownershipCheck() === true
  } catch {
    return true
  }
}
