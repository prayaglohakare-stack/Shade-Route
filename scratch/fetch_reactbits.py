import urllib.request
import json
import os

os.makedirs('scratch/reactbits', exist_ok=True)

components = [
    'Topography-TS-CSS', 'Topography-JS-CSS', 'Topography-TS-TW', 'Topography',
    'TargetCursor-TS-CSS', 'TargetCursor-JS-CSS', 'TargetCursor-TS-TW', 'TargetCursor',
    'TechText-TS-CSS', 'TechText-JS-CSS', 'TechText-TS-TW', 'TechText',
    'topography', 'target-cursor', 'tech-text'
]

for c in components:
    url = f'https://reactbits.dev/r/{c}.json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode('utf-8'))
            name = data.get('name', c)
            files = [f.get('path', f.get('name')) for f in data.get('files', [])]
            print(f'FOUND: {c} -> {name} with files: {files}')
            with open(f'scratch/reactbits/{c}.json', 'w', encoding='utf-8') as out:
                json.dump(data, out, indent=2)
    except Exception as e:
        print(f'Not found or error for {c}: {e}')
