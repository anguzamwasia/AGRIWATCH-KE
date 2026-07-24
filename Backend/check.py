import re
with open('../Frontend/src/components/MapControls.tsx') as f:
    text = f.read()

# remove comments
text = re.sub(r'\{/\*.*?\*/\}', lambda m: '\n' * m.group(0).count('\n'), text, flags=re.DOTALL)
text = re.sub(r'//.*', '', text)

# remove strings
text = re.sub(r'\"(\\\\.|[^\"])*\"', '\"\"', text)
text = re.sub(r'\'(\\\\.|[^\'])*\'', '\"\"', text)

stack = []
for i, line in enumerate(text.split('\n')):
    for char in line:
        if char in '({[':
            stack.append((char, i+1))
        elif char in ')}]':
            if not stack:
                print(f'Unmatched {char} at line {i+1}')
                exit()
            last, li = stack.pop()
            if (last == '(' and char != ')') or (last == '{' and char != '}') or (last == '[' and char != ']'):
                print(f'Mismatched {char} at line {i+1}, expected to close {last} from line {li}')
                exit()

if stack:
    print(f'Unclosed: {stack}')
else:
    print('Brackets perfectly balanced!')
