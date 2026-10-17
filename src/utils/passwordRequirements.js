export const MIN_PASSWORD_LENGTH = 8

export const PASSWORD_REQUIREMENT_CHECKS = [
  {
    id: 'number',
    label: 'Contains at least 1 number',
    test: (value) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'Contains at least 1 special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
  {
    id: 'uppercase',
    label: 'Contains at least 1 uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: 'lowercase',
    label: 'Contains at least 1 lowercase letter',
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: 'length',
    label: `${MIN_PASSWORD_LENGTH} character(s)`,
    test: (value) => value.length >= MIN_PASSWORD_LENGTH,
  },
]

export function getPasswordRequirementStatus(password) {
  return PASSWORD_REQUIREMENT_CHECKS.map((req) => ({
    ...req,
    met: req.test(password),
  }))
}

export function passwordMeetsRequirements(password) {
  return PASSWORD_REQUIREMENT_CHECKS.every((req) => req.test(password))
}

export function passwordRequirementsErrorMessage() {
  return 'Password does not meet all requirements.'
}
