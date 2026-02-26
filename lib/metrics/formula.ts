export type FormulaTokenType =
  | 'metric'
  | 'operator'
  | 'paren'
  | 'number'
  | 'boolean'
  | 'keyword'
  | 'comma'

export type FormulaToken = {
  type: FormulaTokenType
  value: string
}

export type FormulaValueType = 'number' | 'boolean'

export type FormulaAstNode =
  | { type: 'number_literal'; value: number }
  | { type: 'boolean_literal'; value: boolean }
  | { type: 'metric_ref'; code: string }
  | { type: 'unary'; operator: '-'; operand: FormulaAstNode }
  | { type: 'binary'; operator: '+' | '-' | '*' | '/'; left: FormulaAstNode; right: FormulaAstNode }
  | {
      type: 'comparison'
      operator: '=' | '!=' | '>' | '>=' | '<' | '<='
      left: FormulaAstNode
      right: FormulaAstNode
    }
  | { type: 'logical'; operator: 'AND' | 'OR'; operands: FormulaAstNode[] }
  | { type: 'if'; condition: FormulaAstNode; whenTrue: FormulaAstNode; whenFalse: FormulaAstNode }

export type FormulaParseResult =
  | {
      success: true
      tokens: FormulaToken[]
      ast: FormulaAstNode
      metricCodes: string[]
      normalizedExpression: string
      returnType: FormulaValueType
    }
  | {
      success: false
      error: string
    }

export type FormulaValidationResult =
  | {
      success: true
      tokens: FormulaToken[]
      ast: FormulaAstNode
      metricCodes: string[]
      normalizedExpression: string
      returnType: FormulaValueType
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
  metricReturnTypes?: Iterable<[string, FormulaValueType]> | Record<string, FormulaValueType>
}

export type FormulaRuntimeValue =
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }

export type FormulaEvaluationContext = {
  metricValues?: Iterable<[string, number | boolean | null | undefined]> | Record<string, number | boolean | null | undefined>
  metricReturnTypes?: Iterable<[string, FormulaValueType]> | Record<string, FormulaValueType>
}

type TokenizeResult =
  | {
      success: true
      tokens: FormulaToken[]
      normalizedExpression: string
    }
  | { success: false; error: string }

type ParseState = {
  tokens: FormulaToken[]
  index: number
}

function toLower(input: string) {
  return input.trim().toLowerCase()
}

function isDigit(char: string) {
  return char >= '0' && char <= '9'
}

function isIdentifierStart(char: string) {
  return /[a-zA-Z_]/.test(char)
}

function isIdentifierChar(char: string) {
  return /[a-zA-Z0-9_]/.test(char)
}

function tokenError(token: FormulaToken | undefined, message: string) {
  if (!token) {
    return `${message} at end of expression.`
  }

  return `${message} near "${token.value}".`
}

function normalizeExpression(tokens: FormulaToken[]) {
  return tokens.map((token) => token.value).join(' ')
}

function readNumber(input: string, start: number) {
  let index = start
  let dotCount = 0

  while (index < input.length) {
    const current = input[index]
    if (current === '.') {
      dotCount += 1
      if (dotCount > 1) {
        break
      }
      index += 1
      continue
    }

    if (!isDigit(current)) {
      break
    }

    index += 1
  }

  return {
    token: input.slice(start, index),
    nextIndex: index,
  }
}

function tokenizeExpression(expression: string): TokenizeResult {
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

    const pair = input.slice(index, index + 2)
    if (pair === '>=' || pair === '<=' || pair === '!=' || pair === '==') {
      tokens.push({ type: 'operator', value: pair === '==' ? '=' : pair })
      index += 2
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '>' || char === '<' || char === '=') {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index += 1
      continue
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: ',' })
      index += 1
      continue
    }

    if (isDigit(char) || char === '.') {
      const number = readNumber(input, index)
      if (number.token === '.' || number.token.startsWith('.')) {
        return { success: false, error: `Invalid number token "${number.token}".` }
      }

      tokens.push({ type: 'number', value: number.token })
      index = number.nextIndex
      continue
    }

    if (isIdentifierStart(char)) {
      let end = index + 1
      while (end < input.length && isIdentifierChar(input[end])) {
        end += 1
      }

      const rawIdentifier = input.slice(index, end)
      const identifier = toLower(rawIdentifier)

      if (identifier === 'true' || identifier === 'false') {
        tokens.push({ type: 'boolean', value: identifier })
      } else if (identifier === 'if' || identifier === 'and' || identifier === 'or') {
        tokens.push({ type: 'keyword', value: identifier.toUpperCase() })
      } else {
        tokens.push({ type: 'metric', value: identifier })
      }

      index = end
      continue
    }

    return { success: false, error: `Invalid token "${char}".` }
  }

  if (tokens.length === 0) {
    return { success: false, error: 'Formula expression is required.' }
  }

  return {
    success: true,
    tokens,
    normalizedExpression: normalizeExpression(tokens),
  }
}

function current(state: ParseState) {
  return state.tokens[state.index]
}

function peek(state: ParseState, offset = 1) {
  return state.tokens[state.index + offset]
}

function consume(state: ParseState) {
  const token = state.tokens[state.index]
  state.index += 1
  return token
}

function matchParen(state: ParseState, value: '(' | ')') {
  const token = current(state)
  if (token?.type === 'paren' && token.value === value) {
    state.index += 1
    return true
  }
  return false
}

function matchComma(state: ParseState) {
  const token = current(state)
  if (token?.type === 'comma') {
    state.index += 1
    return true
  }
  return false
}

function matchOperator(state: ParseState, operators: string[]) {
  const token = current(state)
  if (token?.type === 'operator' && operators.includes(token.value)) {
    state.index += 1
    return token.value
  }
  return null
}

function matchKeyword(state: ParseState, keyword: 'AND' | 'OR') {
  const token = current(state)
  if (token?.type === 'keyword' && token.value === keyword) {
    state.index += 1
    return true
  }
  return false
}

function expectParen(state: ParseState, value: '(' | ')', message: string) {
  if (!matchParen(state, value)) {
    throw new Error(tokenError(current(state), message))
  }
}

function parsePrimary(state: ParseState): FormulaAstNode {
  const token = current(state)
  if (!token) {
    throw new Error('Unexpected end of formula.')
  }

  if (token.type === 'number') {
    consume(state)
    return {
      type: 'number_literal',
      value: Number(token.value),
    }
  }

  if (token.type === 'boolean') {
    consume(state)
    return {
      type: 'boolean_literal',
      value: token.value === 'true',
    }
  }

  if (token.type === 'metric') {
    const code = token.value
    const next = peek(state)
    consume(state)

    if (next?.type === 'paren' && next.value === '(') {
      return parseFunctionCall(state, code.toUpperCase())
    }

    return {
      type: 'metric_ref',
      code,
    }
  }

  if (token.type === 'keyword') {
    const functionName = token.value
    const next = peek(state)
    consume(state)

    if (!next || next.type !== 'paren' || next.value !== '(') {
      throw new Error(`Keyword "${functionName}" can only be used as a function or logical operator.`)
    }

    return parseFunctionCall(state, functionName)
  }

  if (token.type === 'paren' && token.value === '(') {
    consume(state)
    const expression = parseOr(state)
    expectParen(state, ')', 'Expected ")"')
    return expression
  }

  throw new Error(tokenError(token, 'Unexpected token'))
}

function parseFunctionArgs(state: ParseState) {
  const args: FormulaAstNode[] = []
  expectParen(state, '(', 'Expected "(" after function name')

  if (matchParen(state, ')')) {
    return args
  }

  while (true) {
    args.push(parseOr(state))
    if (matchComma(state)) {
      continue
    }
    expectParen(state, ')', 'Expected ")" to close function arguments')
    break
  }

  return args
}

function parseFunctionCall(state: ParseState, functionName: string): FormulaAstNode {
  const args = parseFunctionArgs(state)
  if (functionName === 'IF') {
    if (args.length !== 3) {
      throw new Error('IF function requires exactly 3 arguments: IF(condition, whenTrue, whenFalse).')
    }

    return {
      type: 'if',
      condition: args[0],
      whenTrue: args[1],
      whenFalse: args[2],
    }
  }

  if (functionName === 'AND' || functionName === 'OR') {
    if (args.length < 2) {
      throw new Error(`${functionName} function requires at least 2 arguments.`)
    }

    return {
      type: 'logical',
      operator: functionName,
      operands: args,
    }
  }

  throw new Error(`Unsupported function "${functionName}".`)
}

function parseUnary(state: ParseState): FormulaAstNode {
  const operator = matchOperator(state, ['-'])
  if (!operator) {
    return parsePrimary(state)
  }

  return {
    type: 'unary',
    operator: '-',
    operand: parseUnary(state),
  }
}

function parseMultiplicative(state: ParseState): FormulaAstNode {
  let left = parseUnary(state)

  while (true) {
    const operator = matchOperator(state, ['*', '/'])
    if (!operator) {
      break
    }

    left = {
      type: 'binary',
      operator: operator as '*' | '/',
      left,
      right: parseUnary(state),
    }
  }

  return left
}

function parseAdditive(state: ParseState): FormulaAstNode {
  let left = parseMultiplicative(state)

  while (true) {
    const operator = matchOperator(state, ['+', '-'])
    if (!operator) {
      break
    }

    left = {
      type: 'binary',
      operator: operator as '+' | '-',
      left,
      right: parseMultiplicative(state),
    }
  }

  return left
}

function parseComparison(state: ParseState): FormulaAstNode {
  const left = parseAdditive(state)
  const operator = matchOperator(state, ['=', '!=', '>', '>=', '<', '<='])
  if (!operator) {
    return left
  }

  const right = parseAdditive(state)
  if (matchOperator(state, ['=', '!=', '>', '>=', '<', '<='])) {
    throw new Error('Only one comparison operator is allowed per expression segment.')
  }

  return {
    type: 'comparison',
    operator: operator as '=' | '!=' | '>' | '>=' | '<' | '<=',
    left,
    right,
  }
}

function parseAnd(state: ParseState): FormulaAstNode {
  let left = parseComparison(state)
  const operands: FormulaAstNode[] = [left]

  while (matchKeyword(state, 'AND')) {
    const right = parseComparison(state)
    operands.push(right)
    left = {
      type: 'logical',
      operator: 'AND',
      operands: [...operands],
    }
  }

  return left
}

function parseOr(state: ParseState): FormulaAstNode {
  let left = parseAnd(state)
  const operands: FormulaAstNode[] = [left]

  while (matchKeyword(state, 'OR')) {
    const right = parseAnd(state)
    operands.push(right)
    left = {
      type: 'logical',
      operator: 'OR',
      operands: [...operands],
    }
  }

  return left
}

function collectMetricCodes(node: FormulaAstNode, set = new Set<string>()) {
  if (node.type === 'metric_ref') {
    set.add(node.code)
    return set
  }

  if (node.type === 'unary') {
    collectMetricCodes(node.operand, set)
    return set
  }

  if (node.type === 'binary' || node.type === 'comparison') {
    collectMetricCodes(node.left, set)
    collectMetricCodes(node.right, set)
    return set
  }

  if (node.type === 'logical') {
    for (const operand of node.operands) {
      collectMetricCodes(operand, set)
    }
    return set
  }

  if (node.type === 'if') {
    collectMetricCodes(node.condition, set)
    collectMetricCodes(node.whenTrue, set)
    collectMetricCodes(node.whenFalse, set)
    return set
  }

  return set
}

function toTypeMap(source?: FormulaValidationOptions['metricReturnTypes']) {
  if (!source) {
    return new Map<string, FormulaValueType>()
  }

  if (Symbol.iterator in Object(source) && !(source instanceof Array) && typeof source !== 'string') {
    const iterable = source as Iterable<[string, FormulaValueType]>
    return new Map(Array.from(iterable, ([code, type]) => [toLower(code), type]))
  }

  const entries = Object.entries(source as Record<string, FormulaValueType>)
  return new Map(entries.map(([code, type]) => [toLower(code), type]))
}

function inferReturnType(node: FormulaAstNode, metricTypes: Map<string, FormulaValueType>): FormulaValueType {
  if (node.type === 'number_literal') {
    return 'number'
  }

  if (node.type === 'boolean_literal') {
    return 'boolean'
  }

  if (node.type === 'metric_ref') {
    return metricTypes.get(node.code) ?? 'number'
  }

  if (node.type === 'unary') {
    const operandType = inferReturnType(node.operand, metricTypes)
    if (operandType !== 'number') {
      throw new Error('Unary "-" can only be used with numeric expressions.')
    }
    return 'number'
  }

  if (node.type === 'binary') {
    const left = inferReturnType(node.left, metricTypes)
    const right = inferReturnType(node.right, metricTypes)
    if (left !== 'number' || right !== 'number') {
      throw new Error(`Operator "${node.operator}" requires numeric operands.`)
    }
    return 'number'
  }

  if (node.type === 'comparison') {
    const left = inferReturnType(node.left, metricTypes)
    const right = inferReturnType(node.right, metricTypes)

    if (node.operator === '=' || node.operator === '!=') {
      if (left !== right) {
        throw new Error('Comparison requires both sides to return the same type.')
      }
      return 'boolean'
    }

    if (left !== 'number' || right !== 'number') {
      throw new Error(`Operator "${node.operator}" requires numeric operands.`)
    }

    return 'boolean'
  }

  if (node.type === 'logical') {
    for (const operand of node.operands) {
      const operandType = inferReturnType(operand, metricTypes)
      if (operandType !== 'boolean') {
        throw new Error(`Logical operator "${node.operator}" requires boolean operands.`)
      }
    }
    return 'boolean'
  }

  const conditionType = inferReturnType(node.condition, metricTypes)
  if (conditionType !== 'boolean') {
    throw new Error('IF condition must be boolean.')
  }

  const trueType = inferReturnType(node.whenTrue, metricTypes)
  const falseType = inferReturnType(node.whenFalse, metricTypes)

  if (trueType !== falseType) {
    throw new Error('IF branches must return the same type.')
  }

  return trueType
}

function asNumber(value: FormulaRuntimeValue, message: string) {
  if (value.kind !== 'number') {
    throw new Error(message)
  }
  return value.value
}

function asBoolean(value: FormulaRuntimeValue, message: string) {
  if (value.kind !== 'boolean') {
    throw new Error(message)
  }
  return value.value
}

function toRuntimeValue(value: number | boolean | null | undefined, expectedType: FormulaValueType): FormulaRuntimeValue {
  if (expectedType === 'boolean') {
    return {
      kind: 'boolean',
      value: typeof value === 'boolean' ? value : false,
    }
  }

  return {
    kind: 'number',
    value: typeof value === 'number' && Number.isFinite(value) ? value : 0,
  }
}

function toValueMap(source?: FormulaEvaluationContext['metricValues']) {
  if (!source) {
    return new Map<string, number | boolean | null | undefined>()
  }

  if (Symbol.iterator in Object(source) && !(source instanceof Array) && typeof source !== 'string') {
    const iterable = source as Iterable<[string, number | boolean | null | undefined]>
    return new Map(Array.from(iterable, ([code, value]) => [toLower(code), value]))
  }

  return new Map(
    Object.entries(source as Record<string, number | boolean | null | undefined>).map(([code, value]) => [
      toLower(code),
      value,
    ]),
  )
}

function evaluateNode(
  node: FormulaAstNode,
  values: Map<string, number | boolean | null | undefined>,
  metricTypes: Map<string, FormulaValueType>,
): FormulaRuntimeValue {
  if (node.type === 'number_literal') {
    return { kind: 'number', value: node.value }
  }

  if (node.type === 'boolean_literal') {
    return { kind: 'boolean', value: node.value }
  }

  if (node.type === 'metric_ref') {
    const expectedType = metricTypes.get(node.code) ?? 'number'
    return toRuntimeValue(values.get(node.code), expectedType)
  }

  if (node.type === 'unary') {
    const operand = evaluateNode(node.operand, values, metricTypes)
    return {
      kind: 'number',
      value: -asNumber(operand, 'Unary "-" requires a numeric operand.'),
    }
  }

  if (node.type === 'binary') {
    const left = asNumber(evaluateNode(node.left, values, metricTypes), `Operator "${node.operator}" requires numeric operands.`)
    const right = asNumber(evaluateNode(node.right, values, metricTypes), `Operator "${node.operator}" requires numeric operands.`)
    if (node.operator === '+') return { kind: 'number', value: left + right }
    if (node.operator === '-') return { kind: 'number', value: left - right }
    if (node.operator === '*') return { kind: 'number', value: left * right }
    return { kind: 'number', value: right === 0 ? 0 : left / right }
  }

  if (node.type === 'comparison') {
    if (node.operator === '=' || node.operator === '!=') {
      const left = evaluateNode(node.left, values, metricTypes)
      const right = evaluateNode(node.right, values, metricTypes)
      if (left.kind !== right.kind) {
        throw new Error('Comparison requires both sides to return the same type.')
      }

      const result = left.value === right.value
      return {
        kind: 'boolean',
        value: node.operator === '=' ? result : !result,
      }
    }

    const left = asNumber(evaluateNode(node.left, values, metricTypes), `Operator "${node.operator}" requires numeric operands.`)
    const right = asNumber(evaluateNode(node.right, values, metricTypes), `Operator "${node.operator}" requires numeric operands.`)

    if (node.operator === '>') return { kind: 'boolean', value: left > right }
    if (node.operator === '>=') return { kind: 'boolean', value: left >= right }
    if (node.operator === '<') return { kind: 'boolean', value: left < right }
    return { kind: 'boolean', value: left <= right }
  }

  if (node.type === 'logical') {
    if (node.operator === 'AND') {
      for (const operand of node.operands) {
        const value = asBoolean(evaluateNode(operand, values, metricTypes), 'Logical AND requires boolean operands.')
        if (!value) {
          return { kind: 'boolean', value: false }
        }
      }
      return { kind: 'boolean', value: true }
    }

    for (const operand of node.operands) {
      const value = asBoolean(evaluateNode(operand, values, metricTypes), 'Logical OR requires boolean operands.')
      if (value) {
        return { kind: 'boolean', value: true }
      }
    }

    return { kind: 'boolean', value: false }
  }

  const condition = asBoolean(
    evaluateNode(node.condition, values, metricTypes),
    'IF condition must be boolean.',
  )

  return condition
    ? evaluateNode(node.whenTrue, values, metricTypes)
    : evaluateNode(node.whenFalse, values, metricTypes)
}

function parseInternal(expression: string): FormulaParseResult {
  const tokenized = tokenizeExpression(expression)
  if (!tokenized.success) {
    return { success: false, error: tokenized.error }
  }

  try {
    const state: ParseState = {
      tokens: tokenized.tokens,
      index: 0,
    }

    const ast = parseOr(state)
    if (state.index < state.tokens.length) {
      return {
        success: false,
        error: tokenError(current(state), 'Unexpected trailing token'),
      }
    }

    const metricCodes = Array.from(collectMetricCodes(ast))
    let returnType: FormulaValueType = 'number'
    try {
      returnType = inferReturnType(ast, new Map())
    } catch {
      // Return type inference is finalized in validate/evaluate with metric type context.
      returnType = 'number'
    }

    return {
      success: true,
      tokens: tokenized.tokens,
      ast,
      metricCodes,
      normalizedExpression: tokenized.normalizedExpression,
      returnType,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid formula expression.',
    }
  }
}

export function parseFormulaExpression(expression: string): FormulaParseResult {
  return parseInternal(expression)
}

export function validateFormulaExpression(
  expression: string,
  options: FormulaValidationOptions = {},
): FormulaValidationResult {
  const parsed = parseInternal(expression)
  if (!parsed.success) {
    return {
      success: false,
      tokens: [],
      metricCodes: [],
      error: parsed.error,
    }
  }

  const knownMetricCodes = options.knownMetricCodes ? new Set(Array.from(options.knownMetricCodes, toLower)) : null
  const disallowMetricCodes = options.disallowMetricCodes
    ? new Set(Array.from(options.disallowMetricCodes, toLower))
    : null

  if (knownMetricCodes) {
    const unknownCode = parsed.metricCodes.find((code) => !knownMetricCodes.has(code))
    if (unknownCode) {
      return {
        success: false,
        tokens: parsed.tokens,
        metricCodes: parsed.metricCodes,
        error: `Unknown metric code "${unknownCode}" in formula.`,
      }
    }
  }

  if (disallowMetricCodes) {
    const disallowedCode = parsed.metricCodes.find((code) => disallowMetricCodes.has(code))
    if (disallowedCode) {
      return {
        success: false,
        tokens: parsed.tokens,
        metricCodes: parsed.metricCodes,
        error: `Metric "${disallowedCode}" cannot reference itself.`,
      }
    }
  }

  try {
    const metricTypes = toTypeMap(options.metricReturnTypes)
    const returnType = inferReturnType(parsed.ast, metricTypes)

    return {
      success: true,
      tokens: parsed.tokens,
      ast: parsed.ast,
      metricCodes: parsed.metricCodes,
      normalizedExpression: parsed.normalizedExpression,
      returnType,
    }
  } catch (error) {
    return {
      success: false,
      tokens: parsed.tokens,
      metricCodes: parsed.metricCodes,
      error: error instanceof Error ? error.message : 'Invalid formula type usage.',
    }
  }
}

export function evaluateFormulaAst(
  ast: FormulaAstNode,
  context: FormulaEvaluationContext = {},
): FormulaRuntimeValue {
  const values = toValueMap(context.metricValues)
  const metricTypes = toTypeMap(context.metricReturnTypes)
  return evaluateNode(ast, values, metricTypes)
}

export function evaluateFormulaExpression(
  expression: string,
  context: FormulaEvaluationContext = {},
) {
  const parsed = parseFormulaExpression(expression)
  if (!parsed.success) {
    return parsed
  }

  const metricTypes = toTypeMap(context.metricReturnTypes)
  try {
    const returnType = inferReturnType(parsed.ast, metricTypes)
    const value = evaluateFormulaAst(parsed.ast, context)
    if (value.kind !== returnType) {
      return {
        success: false as const,
        error: 'Formula evaluation type mismatch.',
      }
    }

    return {
      success: true as const,
      value,
      returnType,
      metricCodes: parsed.metricCodes,
      normalizedExpression: parsed.normalizedExpression,
      ast: parsed.ast,
      tokens: parsed.tokens,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Formula evaluation failed.',
    }
  }
}
