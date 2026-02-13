export type FormulaTokenType = 'metric' | 'operator' | 'paren' | 'number'

export type FormulaToken = {
  type: FormulaTokenType
  value: string
}

export type FormulaParseResult =
  | {
      success: true
      tokens: FormulaToken[]
      normalizedExpression: string
    }
  | {
      success: false
      error: string
    }

export type FormulaValidationResult =
  | {
      success: true
      tokens: FormulaToken[]
      metricCodes: string[]
      normalizedExpression: string
    }
  | {
      success: false
      tokens: FormulaToken[]
      metricCodes: string[]
      error: string
    }

type FormulaValidationOptions = {
  knownMetricCodes?: Iterable<string>
  disallowMetricCodes?: Iterable<string>
}

const OPERATOR_SET = new Set(['+', '-', '*', '/'])

function isDigit(char: string) {
  return char >= '0' && char <= '9'
}

function isIdentifierStart(char: string) {
  return /[a-zA-Z_]/.test(char)
}

function isIdentifierChar(char: string) {
  return /[a-zA-Z0-9_]/.test(char)
}

function tokenizeExpression(expression: string): FormulaParseResult {
  const input = expression.trim()
  if (!input) {
    return { success: false, error: 'Formula expression is required.' }
  }

  const tokens: FormulaToken[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1
      continue
    }

    if (OPERATOR_SET.has(char)) {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index += 1
      continue
    }

    if (isDigit(char) || char === '.') {
      let end = index
      let dotCount = 0

      while (end < input.length) {
        const digitChar = input[end]
        if (digitChar === '.') {
          dotCount += 1
          if (dotCount > 1) {
            break
          }
          end += 1
          continue
        }

        if (!isDigit(digitChar)) {
          break
        }

        end += 1
      }

      const numberToken = input.slice(index, end)
      if (numberToken === '.' || numberToken.startsWith('.')) {
        return { success: false, error: `Invalid number token "${numberToken}".` }
      }

      tokens.push({ type: 'number', value: numberToken })
      index = end
      continue
    }

    if (isIdentifierStart(char)) {
      let end = index + 1
      while (end < input.length && isIdentifierChar(input[end])) {
        end += 1
      }

      tokens.push({
        type: 'metric',
        value: input.slice(index, end).toLowerCase(),
      })
      index = end
      continue
    }

    return { success: false, error: `Invalid token "${char}".` }
  }

  if (tokens.length === 0) {
    return { success: false, error: 'Formula expression is required.' }
  }

  let depth = 0
  let previous: 'start' | 'operand' | 'operator' | 'open' | 'close' = 'start'

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'metric') {
      if (previous === 'operand' || previous === 'close') {
        return {
          success: false,
          error: `Missing operator before "${token.value}".`,
        }
      }
      previous = 'operand'
      continue
    }

    if (token.type === 'paren' && token.value === '(') {
      if (previous === 'operand' || previous === 'close') {
        return {
          success: false,
          error: 'Missing operator before "(".',
        }
      }
      depth += 1
      previous = 'open'
      continue
    }

    if (token.type === 'paren' && token.value === ')') {
      if (depth === 0) {
        return {
          success: false,
          error: 'Unmatched closing parenthesis.',
        }
      }
      if (previous === 'operator' || previous === 'open' || previous === 'start') {
        return {
          success: false,
          error: 'Parentheses cannot be empty.',
        }
      }
      depth -= 1
      previous = 'close'
      continue
    }

    if (token.type === 'operator') {
      if (previous === 'start' || previous === 'operator' || previous === 'open') {
        return {
          success: false,
          error: `Operator "${token.value}" is in an invalid position.`,
        }
      }
      previous = 'operator'
      continue
    }
  }

  if (depth !== 0) {
    return { success: false, error: 'Unclosed parenthesis in formula.' }
  }

  if (previous === 'operator' || previous === 'open' || previous === 'start') {
    return { success: false, error: 'Formula cannot end with an operator.' }
  }

  return {
    success: true,
    tokens,
    normalizedExpression: serializeFormulaTokens(tokens),
  }
}

export function serializeFormulaTokens(tokens: FormulaToken[]) {
  return tokens.map((token) => token.value).join(' ')
}

export function parseFormulaExpression(expression: string): FormulaParseResult {
  return tokenizeExpression(expression)
}

export function validateFormulaExpression(
  expression: string,
  options: FormulaValidationOptions = {},
): FormulaValidationResult {
  const parsed = tokenizeExpression(expression)
  if (!parsed.success) {
    return {
      success: false,
      tokens: [],
      metricCodes: [],
      error: parsed.error,
    }
  }

  const knownMetricCodes = options.knownMetricCodes ? new Set(options.knownMetricCodes) : null
  const disallowMetricCodes = options.disallowMetricCodes ? new Set(options.disallowMetricCodes) : null
  const metricCodes = Array.from(
    parsed.tokens
      .filter((token) => token.type === 'metric')
      .map((token) => token.value)
      .reduce((acc, code) => acc.add(code), new Set<string>()),
  )

  if (knownMetricCodes) {
    const unknownCode = metricCodes.find((code) => !knownMetricCodes.has(code))
    if (unknownCode) {
      return {
        success: false,
        tokens: parsed.tokens,
        metricCodes,
        error: `Unknown metric code "${unknownCode}" in formula.`,
      }
    }
  }

  if (disallowMetricCodes) {
    const disallowedCode = metricCodes.find((code) => disallowMetricCodes.has(code))
    if (disallowedCode) {
      return {
        success: false,
        tokens: parsed.tokens,
        metricCodes,
        error: `Metric "${disallowedCode}" cannot reference itself.`,
      }
    }
  }

  return {
    success: true,
    tokens: parsed.tokens,
    metricCodes,
    normalizedExpression: parsed.normalizedExpression,
  }
}
