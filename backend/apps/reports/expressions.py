"""
Safe Calculated Field Expression Engine

Parses limited expression strings into Django ORM F() / Value() / Case() / When().
NO eval(), NO raw SQL — only whitelisted operations.
"""

import re
from decimal import Decimal, InvalidOperation

from django.db.models import F, Value, Case, When, CharField, DecimalField
from django.db.models.functions import Coalesce, Upper, Lower, Concat


class ExpressionError(Exception):
    """Raised when an expression is invalid or unsafe."""
    pass


# Whitelisted binary operators
BINARY_OPS = {'+', '-', '*', '/'}

# Whitelisted functions
ALLOWED_FUNCTIONS = {'COALESCE', 'UPPER', 'LOWER', 'CONCAT'}


def parse_expression(expr_str: str, allowed_fields: set[str] | None = None):
    """
    Parse a simple expression string into a Django ORM expression.

    Supported forms:
        - "field_name"                    -> F('field_name')
        - "field_a + field_b"             -> F('field_a') + F('field_b')
        - "field_a - field_b"             -> F('field_a') - F('field_b')
        - "field_a * 1.5"                 -> F('field_a') * Value(1.5)
        - "COALESCE(field_name, 0)"       -> Coalesce(F('field_name'), Value(0))

    Args:
        expr_str: The expression string.
        allowed_fields: Optional set of allowed field names for validation.

    Returns:
        A Django ORM expression (F, Value, or combined).

    Raises:
        ExpressionError: If the expression is invalid or references disallowed fields.
    """
    expr_str = expr_str.strip()
    if not expr_str:
        raise ExpressionError("Empty expression.")

    # Check for dangerous patterns
    _validate_safety(expr_str)

    # Try function form: FUNC(args...)
    func_match = re.match(r'^(\w+)\((.+)\)$', expr_str, re.DOTALL)
    if func_match:
        func_name = func_match.group(1).upper()
        if func_name not in ALLOWED_FUNCTIONS:
            raise ExpressionError(f"Function '{func_name}' is not allowed. Allowed: {ALLOWED_FUNCTIONS}")
        args_str = func_match.group(2)
        args = [a.strip() for a in args_str.split(',')]
        return _build_function(func_name, args, allowed_fields)

    # Try binary operation: operand OP operand
    for op in BINARY_OPS:
        # Split on operator (only first-level, not inside parens)
        parts = _split_on_operator(expr_str, op)
        if parts:
            left = _parse_operand(parts[0].strip(), allowed_fields)
            right = _parse_operand(parts[1].strip(), allowed_fields)
            if op == '+':
                return left + right
            elif op == '-':
                return left - right
            elif op == '*':
                return left * right
            elif op == '/':
                return left / right

    # Single operand
    return _parse_operand(expr_str, allowed_fields)


def _parse_operand(token: str, allowed_fields: set[str] | None = None):
    """Parse a single operand token into F() or Value()."""
    token = token.strip()

    # Numeric literal
    try:
        num = Decimal(token)
        return Value(num, output_field=DecimalField())
    except (InvalidOperation, ValueError):
        pass

    # String literal (quoted)
    if (token.startswith('"') and token.endswith('"')) or \
       (token.startswith("'") and token.endswith("'")):
        return Value(token[1:-1])

    # Field reference
    field_name = token.replace('.', '__')
    if allowed_fields and field_name not in allowed_fields:
        raise ExpressionError(f"Field '{field_name}' is not allowed in expressions.")

    return F(field_name)


def _build_function(func_name: str, args: list[str], allowed_fields):
    """Build a Django function expression."""
    parsed_args = [_parse_operand(a, allowed_fields) for a in args]

    if func_name == 'COALESCE':
        if len(parsed_args) < 2:
            raise ExpressionError("COALESCE requires at least 2 arguments.")
        return Coalesce(*parsed_args)
    elif func_name == 'UPPER':
        if len(parsed_args) != 1:
            raise ExpressionError("UPPER requires exactly 1 argument.")
        return Upper(parsed_args[0])
    elif func_name == 'LOWER':
        if len(parsed_args) != 1:
            raise ExpressionError("LOWER requires exactly 1 argument.")
        return Lower(parsed_args[0])
    elif func_name == 'CONCAT':
        if len(parsed_args) < 2:
            raise ExpressionError("CONCAT requires at least 2 arguments.")
        return Concat(*parsed_args)

    raise ExpressionError(f"Unknown function: {func_name}")


def _split_on_operator(expr: str, op: str) -> list[str] | None:
    """Split expression on a binary operator, respecting parentheses."""
    depth = 0
    for i, ch in enumerate(expr):
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif ch == op and depth == 0 and i > 0:
            return [expr[:i], expr[i + 1:]]
    return None


def _validate_safety(expr_str: str):
    """Reject expressions with dangerous patterns."""
    dangerous = [
        'import', 'eval', 'exec', 'compile', 'open',
        '__', 'os.', 'sys.', 'subprocess', 'raw(',
        'DELETE', 'DROP', 'INSERT', 'UPDATE', 'ALTER',
        'GRANT', 'REVOKE', ';',
    ]
    lower = expr_str.lower()
    for pattern in dangerous:
        if pattern.lower() in lower:
            raise ExpressionError(f"Expression contains disallowed pattern: '{pattern}'")
